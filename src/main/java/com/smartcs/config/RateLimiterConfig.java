package com.smartcs.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.concurrent.Semaphore;

/**
 * 限流配置 - 基于Semaphore控制并发请求数
 */
@Slf4j
@Configuration
public class RateLimiterConfig {

    /**
     * 最大并发问答请求数
     */
    private static final int MAX_CONCURRENT_CHAT_REQUESTS = 50;

    private final Semaphore chatSemaphore = new Semaphore(MAX_CONCURRENT_CHAT_REQUESTS);

    @Bean
    public FilterRegistrationBean<ChatRateLimitFilter> chatRateLimitFilter() {
        FilterRegistrationBean<ChatRateLimitFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new ChatRateLimitFilter(chatSemaphore));
        registration.addUrlPatterns("/api/chat", "/api/chat/*");
        registration.setOrder(1);
        return registration;
    }

    /**
     * 聊天请求限流过滤器
     */
    @Slf4j
    public static class ChatRateLimitFilter implements Filter {

        private final Semaphore semaphore;
        private final int maxConcurrent;

        public ChatRateLimitFilter(Semaphore semaphore) {
            this.semaphore = semaphore;
            this.maxConcurrent = MAX_CONCURRENT_CHAT_REQUESTS;
        }

        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws IOException, ServletException {

            if (!semaphore.tryAcquire()) {
                log.warn("并发请求超限，当前已使用: {}", maxConcurrent - semaphore.availablePermits());
                HttpServletResponse httpResponse = (HttpServletResponse) response;
                httpResponse.setStatus(429);
                httpResponse.setContentType("application/json;charset=UTF-8");
                httpResponse.getWriter().write("{\"code\":429,\"message\":\"系统繁忙，请稍后重试\"}");
                return;
            }

            try {
                chain.doFilter(request, response);
            } finally {
                semaphore.release();
            }
        }
    }
}
