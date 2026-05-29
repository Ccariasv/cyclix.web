package com.cyclix.cyclix_api.user


import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "user_statuses")
class UserStatus(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true, length = 50)
    var name: String,

    @Column(length = 255)
    var description: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)