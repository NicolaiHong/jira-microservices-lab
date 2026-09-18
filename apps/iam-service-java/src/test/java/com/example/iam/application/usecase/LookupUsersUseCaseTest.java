package com.example.iam.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.UserIdentity;
import com.example.iam.domain.port.UserRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class LookupUsersUseCaseTest {
    private final UserRepository users = mock(UserRepository.class);
    private final LookupUsersUseCase useCase = new LookupUsersUseCase(users);

    @Test
    void mergesIdAndNormalizedEmailMatchesWithoutDuplicates() {
        UserIdentity alice = new UserIdentity(UUID.randomUUID(), "alice@example.test");
        UserIdentity bob = new UserIdentity(UUID.randomUUID(), "bob@example.test");
        when(users.findIdentitiesByIds(Set.of(alice.id()))).thenReturn(List.of(alice));
        when(users.findIdentitiesByEmails(Set.of("alice@example.test", "bob@example.test")))
            .thenReturn(List.of(alice, bob));

        var result = useCase.execute(
            Arrays.asList(alice.id(), null),
            Arrays.asList(" Alice@Example.TEST ", "bob@example.test", "  ", null)
        );

        assertEquals(List.of(alice, bob), result);
    }

    @Test
    void emptyRequestDoesNotQueryTheRepository() {
        assertEquals(List.of(), useCase.execute(null, List.of()));
        verify(users, never()).findIdentitiesByIds(any());
        verify(users, never()).findIdentitiesByEmails(any());
    }

    @Test
    void rejectsMoreThanTheMaximumEntries() {
        List<UUID> ids = IntStream.rangeClosed(0, LookupUsersUseCase.MaxEntries)
            .mapToObj(index -> UUID.randomUUID())
            .toList();

        DomainException ex = assertThrows(DomainException.class, () -> useCase.execute(ids, List.of()));

        assertEquals(ErrorCodes.ValidationError, ex.getErrorCode());
        verify(users, never()).findIdentitiesByIds(any());
    }
}
