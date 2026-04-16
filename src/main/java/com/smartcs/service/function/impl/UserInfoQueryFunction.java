package com.smartcs.service.function.impl;

import com.alibaba.fastjson2.JSON;
import com.smartcs.service.function.BusinessFunction;
import com.smartcs.service.function.FunctionRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 用户信息查询函数 - 模拟查询用户账户信息
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserInfoQueryFunction implements BusinessFunction {

    private final FunctionRegistry functionRegistry;

    @PostConstruct
    public void init() {
        functionRegistry.register(getName(), this);
    }

    @Override
    public String getName() {
        return "query_user_info";
    }

    @Override
    public String getDescription() {
        return "查询用户账户信息，根据用户ID或手机号查询用户基本信息、会员等级等";
    }

    @Override
    public String getParameterDescription() {
        return "userId(string): 用户ID或手机号";
    }

    @Override
    public String execute(Map<String, Object> parameters) {
        String userId = (String) parameters.get("userId");
        log.info("查询用户信息: {}", userId);

        // 模拟用户数据
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("userId", userId);
        userInfo.put("username", "张三");
        userInfo.put("memberLevel", "黄金会员");
        userInfo.put("points", 12580);
        userInfo.put("registerDate", "2023-06-15");
        userInfo.put("totalOrders", 28);
        userInfo.put("status", "正常");

        return JSON.toJSONString(userInfo);
    }
}
