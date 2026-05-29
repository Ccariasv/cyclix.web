package com.cyclix.cyclix_api

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow

class CyclixApiApplicationTests {

	@Test
	fun applicationClassLoads() {
		assertDoesNotThrow {
			Class.forName("com.cyclix.cyclix_api.CyclixApiApplication")
		}
	}

}
