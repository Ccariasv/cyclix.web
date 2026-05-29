package com.cyclix.cyclix_api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class CyclixApiApplication

fun main(args: Array<String>) {
	runApplication<CyclixApiApplication>(*args)
}
