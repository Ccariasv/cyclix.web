package com.cyclix.cyclix_api.support.dto

import com.cyclix.cyclix_api.support.entity.TicketCategory
import com.cyclix.cyclix_api.support.entity.TicketPriority
import com.cyclix.cyclix_api.support.entity.TicketStatus
import java.time.LocalDateTime

data class SupportTicketResponse(
    val id: Long,
    val userId: Long,
    val bikeId: Long?,
    val tripId: Long?,
    val paymentId: Long?,
    val category: TicketCategory,
    val priority: TicketPriority,
    val status: TicketStatus,
    val title: String,
    val description: String,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)
