package com.cyclix.cyclix_api.support.controller

import com.cyclix.cyclix_api.support.dto.SupportTicketResponse
import com.cyclix.cyclix_api.support.dto.UpdateTicketPriorityRequest
import com.cyclix.cyclix_api.support.dto.UpdateTicketStatusRequest
import com.cyclix.cyclix_api.support.service.SupportTicketService
import jakarta.validation.Valid
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/admin/support/tickets")
@PreAuthorize("hasRole('ADMIN')")
class AdminSupportTicketController(
    private val supportTicketService: SupportTicketService
) {
    @GetMapping
    fun getAllTickets(): List<SupportTicketResponse> =
        supportTicketService.getAllTicketsForAdmin()

    @PutMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateTicketStatusRequest
    ): SupportTicketResponse =
        supportTicketService.updateStatusForAdmin(id, request.status)

    @PutMapping("/{id}/priority")
    fun updatePriority(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateTicketPriorityRequest
    ): SupportTicketResponse =
        supportTicketService.updatePriorityForAdmin(id, request.priority)
}
