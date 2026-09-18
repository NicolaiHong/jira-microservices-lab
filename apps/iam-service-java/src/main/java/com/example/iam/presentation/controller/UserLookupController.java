package com.example.iam.presentation.controller;

import com.example.iam.application.usecase.LookupUsersUseCase;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserLookupController {
    private final LookupUsersUseCase lookupUsersUseCase;

    public UserLookupController(LookupUsersUseCase lookupUsersUseCase) {
        this.lookupUsersUseCase = lookupUsersUseCase;
    }

    @PostMapping("/internal/users/lookup")
    public UserLookupResponse lookup(@RequestBody UserLookupRequest request) {
        return new UserLookupResponse(
            lookupUsersUseCase.execute(request.ids(), request.emails()).stream()
                .map(identity -> new UserLookupItem(identity.id(), identity.email()))
                .toList()
        );
    }

    public record UserLookupRequest(List<UUID> ids, List<String> emails) {}

    public record UserLookupItem(UUID id, String email) {}

    public record UserLookupResponse(List<UserLookupItem> items) {}
}
