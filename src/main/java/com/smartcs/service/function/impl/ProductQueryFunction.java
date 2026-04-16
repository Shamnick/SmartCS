package com.smartcs.service.function.impl;

import com.alibaba.fastjson2.JSON;
import com.smartcs.service.function.BusinessFunction;
import com.smartcs.service.function.FunctionRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 产品查询函数 - 模拟查询产品信息
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProductQueryFunction implements BusinessFunction {

    private final FunctionRegistry functionRegistry;

    @PostConstruct
    public void init() {
        functionRegistry.register(getName(), this);
    }

    @Override
    public String getName() {
        return "query_product";
    }

    @Override
    public String getDescription() {
        return "查询产品信息，根据产品名称或ID查询产品详情、价格、库存等";
    }

    @Override
    public String getParameterDescription() {
        return "keyword(string): 产品名称或ID";
    }

    @Override
    public String execute(Map<String, Object> parameters) {
        String keyword = (String) parameters.get("keyword");
        log.info("查询产品: {}", keyword);

        // 模拟产品数据
        Map<String, Object> productInfo = new HashMap<>();
        productInfo.put("productId", "P" + System.currentTimeMillis() % 10000);
        productInfo.put("productName", keyword);
        productInfo.put("price", 599.00);
        productInfo.put("stock", 128);
        productInfo.put("category", "电子产品");
        productInfo.put("description", keyword + " - 高品质产品，支持7天无理由退换货");
        productInfo.put("specifications", List.of("规格A", "规格B", "规格C"));

        return JSON.toJSONString(productInfo);
    }
}
