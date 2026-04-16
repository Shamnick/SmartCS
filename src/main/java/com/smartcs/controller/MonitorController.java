package com.smartcs.controller;

import com.smartcs.model.common.R;
import com.smartcs.monitor.PerformanceMonitor;
import com.smartcs.service.ChatService;
import com.smartcs.service.KnowledgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 监控控制器 - 系统运行状态和性能监控
 */
@RestController
@RequestMapping("/api/monitor")
@RequiredArgsConstructor
public class MonitorController {

    private final PerformanceMonitor performanceMonitor;
    private final ChatService chatService;
    private final KnowledgeService knowledgeService;

    /**
     * 获取系统总览
     */
    @GetMapping("/overview")
    public R<Map<String, Object>> overview() {
        Map<String, Object> overview = new HashMap<>();
        overview.put("activeSessions", chatService.getActiveSessionCount());
        overview.put("knowledgeBase", knowledgeService.getStatistics());
        overview.put("jvm", getJvmInfo());
        return R.ok(overview);
    }

    /**
     * 获取性能指标
     */
    @GetMapping("/metrics")
    public R<Map<String, Object>> metrics() {
        return R.ok(performanceMonitor.getMetrics());
    }

    /**
     * 重置性能统计
     */
    @PostMapping("/metrics/reset")
    public R<Void> resetMetrics() {
        performanceMonitor.resetMetrics();
        return R.ok();
    }

    /**
     * JVM信息
     */
    private Map<String, Object> getJvmInfo() {
        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> jvm = new HashMap<>();
        jvm.put("maxMemory", runtime.maxMemory() / 1024 / 1024 + "MB");
        jvm.put("totalMemory", runtime.totalMemory() / 1024 / 1024 + "MB");
        jvm.put("freeMemory", runtime.freeMemory() / 1024 / 1024 + "MB");
        jvm.put("usedMemory", (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024 + "MB");
        jvm.put("availableProcessors", runtime.availableProcessors());
        return jvm;
    }
}
