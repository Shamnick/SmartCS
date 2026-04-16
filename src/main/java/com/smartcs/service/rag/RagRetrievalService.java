package com.smartcs.service.rag;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * RAG检索服务 - 从Milvus向量数据库中检索相关文档
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RagRetrievalService {

    private static final double RELAXED_SIMILARITY_THRESHOLD = 0.15D;

    private final EmbeddingService embeddingService;
    private final EmbeddingStore<TextSegment> embeddingStore;

    @Value("${rag.max-results}")
    private int maxResults;

    @Value("${rag.similarity-threshold}")
    private double similarityThreshold;

    /**
     * 根据查询检索相关文档片段
     */
    @Cacheable(value = "documentCache", key = "#query", unless = "#result.isEmpty()")
    public List<EmbeddingMatch<TextSegment>> retrieve(String query) {
        log.info("开始RAG检索, 查询: {}", query);
        long startTime = System.currentTimeMillis();

        // 查询向量化
        Embedding queryEmbedding = embeddingService.embedQuery(query);

        List<EmbeddingMatch<TextSegment>> matches = search(queryEmbedding, similarityThreshold);
        if (matches.isEmpty() && similarityThreshold > RELAXED_SIMILARITY_THRESHOLD) {
            matches = search(queryEmbedding, RELAXED_SIMILARITY_THRESHOLD);
            if (!matches.isEmpty()) {
                log.info("RAG检索在放宽阈值后命中结果, relaxedThreshold={}", RELAXED_SIMILARITY_THRESHOLD);
            }
        }

        log.info("RAG检索完成, 找到{}条相关文档, 耗时: {}ms",
                matches.size(), System.currentTimeMillis() - startTime);

        matches.forEach(match ->
                log.debug("匹配文档 - 分数: {}, 内容: {}",
                        match.score(),
                        match.embedded().text().substring(0, Math.min(100, match.embedded().text().length()))));

        return matches;
    }

    private List<EmbeddingMatch<TextSegment>> search(Embedding queryEmbedding, double minScore) {
        EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(queryEmbedding)
                .maxResults(maxResults)
                .minScore(minScore)
                .build();

        EmbeddingSearchResult<TextSegment> searchResult = embeddingStore.search(searchRequest);
        return searchResult.matches();
    }

    /**
     * 检索并格式化为上下文字符串
     */
    public String retrieveAndFormat(String query) {
        List<EmbeddingMatch<TextSegment>> matches = retrieve(query);

        if (matches.isEmpty()) {
            return "未在知识库中找到相关信息。";
        }

        StringBuilder context = new StringBuilder("【知识库检索结果】\n\n");
        for (int i = 0; i < matches.size(); i++) {
            EmbeddingMatch<TextSegment> match = matches.get(i);
            context.append(String.format("--- 文档片段 %d (相似度: %.2f) ---\n", i + 1, match.score()));
            context.append(match.embedded().text());
            context.append("\n\n");
        }

        return context.toString();
    }

    /**
     * 检索结果转换为ChatResponse中的KnowledgeSource
     */
    public List<com.smartcs.model.dto.ChatResponse.KnowledgeSource> toKnowledgeSources(
            List<EmbeddingMatch<TextSegment>> matches) {
        return matches.stream()
                .map(match -> com.smartcs.model.dto.ChatResponse.KnowledgeSource.builder()
                        .documentName(match.embedded().metadata().getString("document_name"))
                        .content(match.embedded().text())
                        .score(match.score())
                        .build())
                .collect(Collectors.toList());
    }
}
