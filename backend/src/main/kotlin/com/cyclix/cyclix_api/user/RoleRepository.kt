package com.cyclix.cyclix_api.user

import com.cyclix.cyclix_api.user.Role

import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface RoleRepository : JpaRepository<Role, Long> {
    fun findByName(name: String): Optional<Role>
}