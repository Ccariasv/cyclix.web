package com.cyclix.cyclix_api.support.dto

import com.cyclix.cyclix_api.support.entity.TicketCategory
import com.cyclix.cyclix_api.support.entity.TicketPriority
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CreateSupportTicketRequest(
    val bikeId: Long? = null,
    val tripId: Long? = null,
    val paymentId: Long? = null,
    val category: TicketCategory,
    val priority: TicketPriority? = null,

    @field:NotBlank(message = "El título es obligatorio")
    @field:Size(max = 180, message = "El título no puede exceder 180 caracteres")
    val title: String,

    @field:NotBlank(message = "La descripción es obligatoria")
    @field:Size(max = 4000, message = "La descripción no puede exceder 4000 caracteres")
    val description: String
)
