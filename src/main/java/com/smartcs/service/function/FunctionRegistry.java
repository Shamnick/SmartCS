package com.smartcs.service.function;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Function注册中心 - 管理所有可供大模型调用的业务函数
 */
@Slf4j
@Component
public class FunctionRegistry {

    private final Map<String, BusinessFunction> functions = new HashMap<>();

    /**
     * 注册业务函数
     */
    public void register(String name, BusinessFunction function) {
        functions.put(name, function);
        log.info("注册业务函数: {}", name);
    }

    /**
     * 获取业务函数
     */
    public BusinessFunction getFunction(String name) {
        return functions.get(name);
    }

    /**
     * 执行业务函数
     */
    public String execute(String name, Map<String, Object> parameters) {
        BusinessFunction function = functions.get(name);
        if (function == null) {
            throw new IllegalArgumentException("未找到业务函数: " + name);
        }
        log.info("执行业务函数: {}, 参数: {}", name, parameters);
        return function.execute(parameters);
    }

    /**
     * 获取所有已注册函数名称
     */
    public Set<String> getFunctionNames() {
        return functions.keySet();
    }

    /**
     * 获取所有函数的描述信息(供Prompt使用)
     */
    public String getFunctionDescriptions() {
        StringBuilder sb = new StringBuilder();
        sb.append("可用的业务函数列表:\n");
        functions.forEach((name, func) -> {
            sb.append(String.format("- %s: %s\n", name, func.getDescription()));
            sb.append(String.format("  参数: %s\n", func.getParameterDescription()));
        });
        return sb.toString();
    }
}
