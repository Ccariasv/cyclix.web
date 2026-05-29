package com.cyclix.cyclix_api.user

import com.cyclix.cyclix_api.user.UserStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface UserStatusRepository : JpaRepository<UserStatus, Long> {
    fun findByName(name: String): Optional<UserStatus>
}
