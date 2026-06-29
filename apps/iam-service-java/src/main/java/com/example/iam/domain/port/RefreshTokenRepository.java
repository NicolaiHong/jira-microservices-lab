package com.example.iam.domain.port;

import com.example.iam.domain.model.RefreshToken;

public interface RefreshTokenRepository {
    void save(RefreshToken token);
}
