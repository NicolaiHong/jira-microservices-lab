package com.example.iam.application.usecase;

import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.UserIdentity;
import com.example.iam.domain.port.UserRepository;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public final class LookupUsersUseCase {
    public static final int MaxEntries = 100;

    private final UserRepository userRepository;

    public LookupUsersUseCase(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserIdentity> execute(Collection<UUID> ids, Collection<String> emails) {
        Set<UUID> distinctIds = ids == null
            ? Set.of()
            : ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> normalizedEmails = emails == null
            ? Set.of()
            : emails.stream()
                .filter(Objects::nonNull)
                .map(email -> email.trim().toLowerCase(Locale.ROOT))
                .filter(email -> !email.isEmpty())
                .collect(Collectors.toSet());
        if (distinctIds.size() > MaxEntries || normalizedEmails.size() > MaxEntries) {
            throw new DomainException(
                ErrorCodes.ValidationError,
                "At most " + MaxEntries + " ids and " + MaxEntries + " emails can be looked up"
            );
        }

        Map<UUID, UserIdentity> found = new LinkedHashMap<>();
        if (!distinctIds.isEmpty()) {
            userRepository.findIdentitiesByIds(distinctIds)
                .forEach(identity -> found.put(identity.id(), identity));
        }
        if (!normalizedEmails.isEmpty()) {
            userRepository.findIdentitiesByEmails(normalizedEmails)
                .forEach(identity -> found.put(identity.id(), identity));
        }
        return List.copyOf(found.values());
    }
}
