package com.smartcs.service.function;

import java.util.Map;

/**
 * 业务函数接口 - 供大模型通过Function Calling调用
 */
public interface BusinessFunction {

    /**
     * 函数名称
     */
    String getName();

    /**
     * 函数描述
     */
    String getDescription();

    /**
     * 参数描述
     */
    String getParameterDescription();

    /**
     * 执行函数
     */
    String execute(Map<String, Object> parameters);
}
