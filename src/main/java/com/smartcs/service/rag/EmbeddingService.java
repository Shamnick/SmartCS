package com.smartcs.service.rag;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Embedding服务 - 负责文本向量化和存储
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;

    /**
     * 将文本段列表向量化并存储到Milvus
     */
    public void embedAndStore(List<TextSegment> segments) {
        log.info("开始向量化并存储, 共{}个片段", segments.size());
        long startTime = System.currentTimeMillis();

        try {
            // 批量Embedding
            Response<List<Embedding>> embeddings = embeddingModel.embedAll(segments);
            log.info("向量化完成, 耗时: {}ms", System.currentTimeMillis() - startTime);

            // 存储到Milvus
            embeddingStore.addAll(embeddings.content(), segments);
            log.info("向量存储完成, 共存储{}条向量, 总耗时: {}ms",
                    segments.size(), System.currentTimeMillis() - startTime);
        } catch (Exception e) {
            log.error("向量化存储失败", e);
            throw new RuntimeException("向量化存储失败", e);
        }
    }

    /**
     * 异步向量化并存储
     */
    @Async("embeddingExecutor")
    public CompletableFuture<Void> embedAndStoreAsync(List<TextSegment> segments) {
        embedAndStore(segments);
        return CompletableFuture.completedFuture(null);
    }

    /**
     * 对查询文本进行向量化
     */
    @Cacheable(value = "embeddingCache", key = "#query")
    public Embedding embedQuery(String query) {
        log.debug("查询文本向量化: {}", query);
        Response<Embedding> response = embeddingModel.embed(query);
        return response.content();
    }

    /**
     * 批量向量化 - 分批处理避免OOM
     */
    public void embedAndStoreBatch(List<TextSegment> segments, int batchSize) {
        log.info("开始分批向量化, 总计{}条, 每批{}条", segments.size(), batchSize);

        for (int i = 0; i < segments.size(); i += batchSize) {
            int end = Math.min(i + batchSize, segments.size());
            List<TextSegment> batch = segments.subList(i, end);
            embedAndStore(batch);
            log.info("批次 {}/{} 处理完成", (i / batchSize) + 1,
                    (int) Math.ceil((double) segments.size() / batchSize));
        }
    }
}
