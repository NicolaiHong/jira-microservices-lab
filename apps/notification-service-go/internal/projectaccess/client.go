package projectaccess

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const projectNotFoundCode = "PROJECT_NOT_FOUND"

// Decision is the current-access outcome for a candidate notification recipient.
type Decision int

const (
	Eligible Decision = iota
	NotEligible
)

// Checker verifies a recipient's current Project read access.
type Checker interface {
	CheckAccess(ctx context.Context, projectID, userID, correlationID string) (Decision, error)
}

// Client is the small internal Notification-to-Project HTTP client.
type Client struct {
	baseURL *url.URL
	secret  string
	http    *http.Client
}

type accessContextResponse struct {
	ProjectID      string `json:"projectId"`
	WorkspaceID    string `json:"workspaceId"`
	ProjectKey     string `json:"projectKey"`
	ProjectStatus  string `json:"projectStatus"`
	MembershipRole string `json:"membershipRole"`
}

type errorResponse struct {
	Code string `json:"code"`
}

// NewClient validates all configuration that is required for current-access
// verification before the consumer can begin processing events.
func NewClient(projectServiceURL, internalServiceSecret string, timeout time.Duration) (*Client, error) {
	if strings.TrimSpace(internalServiceSecret) == "" {
		return nil, errors.New("INTERNAL_SERVICE_SECRET is required for project access checks")
	}
	if timeout <= 0 {
		return nil, errors.New("HTTP_CLIENT_TIMEOUT_MS must be greater than zero")
	}

	parsedURL, err := url.Parse(strings.TrimSpace(projectServiceURL))
	if err != nil {
		return nil, fmt.Errorf("parse PROJECT_SERVICE_URL: %w", err)
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return nil, errors.New("PROJECT_SERVICE_URL must use http or https")
	}
	if parsedURL.Host == "" || parsedURL.User != nil || parsedURL.RawQuery != "" || parsedURL.Fragment != "" {
		return nil, errors.New("PROJECT_SERVICE_URL must be an origin URL without credentials, query, or fragment")
	}
	if parsedURL.Path != "" && parsedURL.Path != "/" {
		return nil, errors.New("PROJECT_SERVICE_URL must not include a path")
	}
	parsedURL.Path = ""

	return &Client{
		baseURL: parsedURL,
		secret:  internalServiceSecret,
		http: &http.Client{
			Timeout: timeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}, nil
}

// CheckAccess returns NotEligible only for the documented PROJECT_NOT_FOUND
// response. Every other dependency, authentication, response-shape, or HTTP
// failure is returned to Kafka processing as a retryable error.
func (c *Client) CheckAccess(
	ctx context.Context,
	projectID string,
	userID string,
	correlationID string,
) (Decision, error) {
	endpoint, err := c.accessContextURL(projectID)
	if err != nil {
		return NotEligible, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return NotEligible, fmt.Errorf("create project access request: %w", err)
	}
	request.Header.Set("x-authenticated-user-id", userID)
	request.Header.Set("x-internal-service-secret", c.secret)
	request.Header.Set("x-correlation-id", correlationID)

	response, err := c.http.Do(request)
	if err != nil {
		return NotEligible, fmt.Errorf("request project access context: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusOK {
		contextResponse, err := decodeAccessContext(response.Body)
		if err != nil {
			return NotEligible, fmt.Errorf("decode project access context: %w", err)
		}
		if err := validateAccessContext(contextResponse, projectID); err != nil {
			return NotEligible, fmt.Errorf("validate project access context: %w", err)
		}
		return Eligible, nil
	}

	if response.StatusCode == http.StatusNotFound {
		projectError, err := decodeErrorResponse(response.Body)
		if err != nil {
			return NotEligible, fmt.Errorf("decode project access error response: %w", err)
		}
		if projectError.Code == projectNotFoundCode {
			return NotEligible, nil
		}
		return NotEligible, fmt.Errorf("unexpected project access 404 code %q", projectError.Code)
	}

	return NotEligible, fmt.Errorf("unexpected project access response status %d", response.StatusCode)
}

func (c *Client) accessContextURL(projectID string) (string, error) {
	if strings.TrimSpace(projectID) == "" {
		return "", errors.New("project ID is required")
	}
	endpoint := *c.baseURL
	endpoint.Path = "/internal/projects/" + url.PathEscape(projectID) + "/access-context"
	endpoint.RawPath = ""
	return endpoint.String(), nil
}

func decodeAccessContext(body io.Reader) (accessContextResponse, error) {
	var response accessContextResponse
	if err := decodeSingleJSON(body, &response); err != nil {
		return accessContextResponse{}, err
	}
	return response, nil
}

func decodeErrorResponse(body io.Reader) (errorResponse, error) {
	var response errorResponse
	if err := decodeSingleJSON(body, &response); err != nil {
		return errorResponse{}, err
	}
	return response, nil
}

func decodeSingleJSON(body io.Reader, target any) error {
	decoder := json.NewDecoder(io.LimitReader(body, 64*1024))
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("response contains multiple JSON values")
		}
		return err
	}
	return nil
}

func validateAccessContext(response accessContextResponse, requestedProjectID string) error {
	if !isUUID(response.ProjectID) || !isUUID(response.WorkspaceID) {
		return errors.New("projectId and workspaceId must be UUIDs")
	}
	if !strings.EqualFold(strings.TrimSpace(response.ProjectID), strings.TrimSpace(requestedProjectID)) {
		return errors.New("projectId does not match the requested project")
	}
	if strings.TrimSpace(response.WorkspaceID) == "" || strings.TrimSpace(response.ProjectKey) == "" {
		return errors.New("workspaceId and projectKey are required")
	}
	if response.ProjectStatus != "ACTIVE" && response.ProjectStatus != "ARCHIVED" {
		return fmt.Errorf("unsupported projectStatus %q", response.ProjectStatus)
	}
	switch response.MembershipRole {
	case "MEMBER", "ADMIN", "OWNER":
		return nil
	default:
		return fmt.Errorf("unsupported membershipRole %q", response.MembershipRole)
	}
}

func isUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		switch index {
		case 8, 13, 18, 23:
			if character != '-' {
				return false
			}
		default:
			if !(character >= '0' && character <= '9') &&
				!(character >= 'a' && character <= 'f') &&
				!(character >= 'A' && character <= 'F') {
				return false
			}
		}
	}
	return true
}
