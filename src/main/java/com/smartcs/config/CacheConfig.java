package com.smartcs.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

/**
 * 多级缓存配置 - Caffeine本地缓存 + Redis分布式缓存
 */
@Configuration
public class CacheConfig {

    /**
     * Caffeine本地缓存 - 用于高频问答结果缓存
     */
    @Bean
    @Primary
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(30, TimeUnit.MINUTES)
                .recordStats());
        cacheManager.setCacheNames(java.util.List.of(
                "chatCache",
                "embeddingCache",
                "documentCache",
                "functionResultCache"
        ));
        return cacheManager;
    }
}
