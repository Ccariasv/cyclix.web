package com.cyclix.cyclix_api.support.entity

import com.cyclix.cyclix_api.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "support_tickets")
class SupportTicket(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User,

    @Column(name = "bike_id")
    var bikeId: Long? = null,

    @Column(name = "trip_id")
    var tripId: Long? = null,

    @Column(name = "payment_id")
    var paymentId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    var category: TicketCategory,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    var priority: TicketPriority,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    var status: TicketStatus = TicketStatus.OPEN,

    @Column(nullable = false, length = 180)
    var title: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    var description: String,

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
) {
    @PrePersist
    fun prePersist() {
        val now = LocalDateTime.now()
        createdAt = now
        updatedAt = now
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = LocalDateTime.now()
    }
}
