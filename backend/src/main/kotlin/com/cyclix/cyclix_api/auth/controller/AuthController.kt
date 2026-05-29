package com.cyclix.cyclix_api.auth.controller

import com.cyclix.cyclix_api.auth.dto.AuthResponse
import com.cyclix.cyclix_api.auth.dto.LoginRequest
import com.cyclix.cyclix_api.auth.dto.RegisterRequest
import com.cyclix.cyclix_api.auth.service.AuthService
import io.swagger.v3.oas.annotations.security.SecurityRequirements
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
@SecurityRequirements
class AuthController(
    private val authService: AuthService
) {
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody request: RegisterRequest): Map<String, Any> {
        val userId = authService.register(request)

        return mapOf(
            "message" to "Usuario registrado correctamente",
            "userId" to userId
        )
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LoginRequest): AuthResponse =
        authService.login(request)
}
