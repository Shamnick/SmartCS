package com.smartcs.service.function.impl;

import com.smartcs.service.function.BusinessFunction;
import com.smartcs.service.function.FunctionRegistry;
import com.smartcs.service.rag.RagRetrievalService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 知识检索函数 - 大模型可主动触发知识库搜索
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KnowledgeSearchFunction implements BusinessFunction {

    private final FunctionRegistry functionRegistry;
    private final RagRetrievalService ragRetrievalService;

    @PostConstruct
    public void init() {
        functionRegistry.register(getName(), this);
    }

    @Override
    public String getName() {
        return "search_knowledge";
    }

    @Override
    public String getDescription() {
        return "搜索企业知识库，根据关键词检索相关的知识文档内容";
    }

    @Override
    public String getParameterDescription() {
        return "query(string): 搜索关键词";
    }

    @Override
    public String execute(Map<String, Object> parameters) {
        String query = (String) parameters.get("query");
        log.info("知识库检索: {}", query);
        return ragRetrievalService.retrieveAndFormat(query);
    }
}
