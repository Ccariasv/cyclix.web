package com.cyclix.cyclix_api.auth.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank

data class LoginRequest(
    @field:Email(message = "El correo no es válido")
    @field:NotBlank(message = "El correo es obligatorio")
    val email: String,

    @field:NotBlank(message = "La contraseña es obligatoria")
    val password: String
)
