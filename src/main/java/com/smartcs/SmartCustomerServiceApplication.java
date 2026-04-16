package com.smartcs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(exclude = {RedisAutoConfiguration.class})
@EnableCaching
@EnableAsync
public class SmartCustomerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartCustomerServiceApplication.class, args);
    }
}
