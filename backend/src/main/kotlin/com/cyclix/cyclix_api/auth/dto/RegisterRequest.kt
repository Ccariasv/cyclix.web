package com.cyclix.cyclix_api.auth.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank(message = "El nombre es obligatorio")
    @field:Size(max = 100, message = "El nombre no puede exceder 100 caracteres")
    val firstName: String,

    @field:Size(max = 100, message = "El apellido no puede exceder 100 caracteres")
    val lastName: String? = null,

    @field:Email(message = "El correo no es válido")
    @field:NotBlank(message = "El correo es obligatorio")
    @field:Size(max = 150, message = "El correo no puede exceder 150 caracteres")
    val email: String,

    @field:Size(max = 30, message = "El teléfono no puede exceder 30 caracteres")
    val phone: String? = null,

    @field:NotBlank(message = "La contraseña es obligatoria")
    @field:Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres")
    val password: String
)
