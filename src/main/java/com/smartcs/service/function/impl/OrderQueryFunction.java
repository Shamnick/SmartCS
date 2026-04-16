package com.smartcs.service.function.impl;

import com.alibaba.fastjson2.JSON;
import com.smartcs.service.function.BusinessFunction;
import com.smartcs.service.function.FunctionRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * 订单查询函数 - 模拟查询订单信息
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderQueryFunction implements BusinessFunction {

    private final FunctionRegistry functionRegistry;

    @PostConstruct
    public void init() {
        functionRegistry.register(getName(), this);
    }

    @Override
    public String getName() {
        return "query_order";
    }

    @Override
    public String getDescription() {
        return "查询订单信息，根据订单号查询订单状态、金额等详细信息";
    }

    @Override
    public String getParameterDescription() {
        return "orderId(string): 订单编号";
    }

    @Override
    public String execute(Map<String, Object> parameters) {
        String orderId = (String) parameters.get("orderId");
        log.info("查询订单: {}", orderId);

        // 模拟订单数据
        Map<String, Object> orderInfo = new HashMap<>();
        orderInfo.put("orderId", orderId);
        orderInfo.put("status", "已发货");
        orderInfo.put("amount", 299.99);
        orderInfo.put("createTime", LocalDateTime.now().minusDays(3)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        orderInfo.put("estimatedDelivery", LocalDateTime.now().plusDays(2)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        orderInfo.put("trackingNumber", "SF" + System.currentTimeMillis());

        return JSON.toJSONString(orderInfo);
    }
}
