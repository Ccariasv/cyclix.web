package com.cyclix.cyclix_api.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional
import com.cyclix.cyclix_api.user.User

interface UserRepository : JpaRepository<User, Long> {
    fun existsByEmail(email: String): Boolean
    fun findByEmail(email: String): Optional<User>
    fun findAllByOrderByIdAsc(): List<User>
}
