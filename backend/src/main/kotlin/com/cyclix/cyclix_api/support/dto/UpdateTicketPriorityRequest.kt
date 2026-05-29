package com.cyclix.cyclix_api.support.dto

import jakarta.validation.constraints.NotBlank

data class UpdateTicketPriorityRequest(
    @field:NotBlank(message = "La prioridad es obligatoria")
    val priority: String
)
