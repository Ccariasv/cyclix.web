package com.cyclix.cyclix_api.user.dto

import jakarta.validation.constraints.NotBlank

data class AssignUserRoleRequest(
    @field:NotBlank(message = "El rol es obligatorio")
    val role: String
)
