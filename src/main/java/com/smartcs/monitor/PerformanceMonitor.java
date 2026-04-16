package com.smartcs.monitor;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 性能监控 - AOP切面记录关键方法性能指标
 */
@Slf4j
@Aspect
@Component
public class PerformanceMonitor {

    /**
     * 方法调用计数
     */
    private final Map<String, AtomicLong> callCount = new ConcurrentHashMap<>();

    /**
     * 方法总耗时
     */
    private final Map<String, AtomicLong> totalTime = new ConcurrentHashMap<>();

    /**
     * 方法最大耗时
     */
    private final Map<String, AtomicLong> maxTime = new ConcurrentHashMap<>();

    /**
     * 监控Service层方法
     */
    @Around("execution(* com.smartcs.service..*(..))")
    public Object monitorService(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getDeclaringTypeName() + "."
                + joinPoint.getSignature().getName();

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long costTime = System.currentTimeMillis() - startTime;

            recordMetrics(methodName, costTime);

            if (costTime > 5000) {
                log.warn("慢方法告警 - {}: {}ms", methodName, costTime);
            } else {
                log.debug("方法耗时 - {}: {}ms", methodName, costTime);
            }

            return result;
        } catch (Throwable e) {
            long costTime = System.currentTimeMillis() - startTime;
            log.error("方法异常 - {}: {}ms", methodName, costTime);
            throw e;
        }
    }

    /**
     * 记录指标
     */
    private void recordMetrics(String methodName, long costTime) {
        callCount.computeIfAbsent(methodName, k -> new AtomicLong(0)).incrementAndGet();
        totalTime.computeIfAbsent(methodName, k -> new AtomicLong(0)).addAndGet(costTime);
        maxTime.computeIfAbsent(methodName, k -> new AtomicLong(0))
                .updateAndGet(current -> Math.max(current, costTime));
    }

    /**
     * 获取性能统计信息
     */
    public Map<String, Object> getMetrics() {
        Map<String, Object> metrics = new ConcurrentHashMap<>();

        callCount.forEach((method, count) -> {
            long total = totalTime.getOrDefault(method, new AtomicLong(0)).get();
            long max = maxTime.getOrDefault(method, new AtomicLong(0)).get();
            long avg = count.get() > 0 ? total / count.get() : 0;

            metrics.put(method, Map.of(
                    "callCount", count.get(),
                    "totalTime", total,
                    "avgTime", avg,
                    "maxTime", max
            ));
        });

        return metrics;
    }

    /**
     * 重置统计
     */
    public void resetMetrics() {
        callCount.clear();
        totalTime.clear();
        maxTime.clear();
    }
}
