package com.smartcs.config;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import dev.langchain4j.store.embedding.milvus.MilvusEmbeddingStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * 向量数据库配置
 * 优先连接Milvus，连接失败时回退到内存向量存储（开发/演示模式）
 */
@Slf4j
@Configuration
public class MilvusConfig {

    @Value("${milvus.host}")
    private String host;

    @Value("${milvus.port}")
    private int port;

    @Value("${milvus.collection-name}")
    private String collectionName;

    @Value("${milvus.dimension}")
    private int dimension;

    @Value("${milvus.metric-type}")
    private String metricType;

    /**
     * EmbeddingStore - 优先Milvus，回退InMemory
     */
    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        if (!isMilvusReachable()) {
            log.warn("Milvus服务不可达，直接回退到内存向量存储(仅限开发/演示)");
            return new InMemoryEmbeddingStore<>();
        }

        try {
            log.info("尝试连接Milvus: {}:{}", host, port);
            EmbeddingStore<TextSegment> store = MilvusEmbeddingStore.builder()
                    .host(host)
                    .port(port)
                    .collectionName(collectionName)
                    .dimension(dimension)
                    .build();
            log.info("Milvus连接成功，使用Milvus作为向量存储");
            return store;
        } catch (Exception e) {
            log.warn("Milvus连接失败({}), 回退到内存向量存储(仅限开发/演示)", e.getMessage());
            return new InMemoryEmbeddingStore<>();
        }
    }

    private boolean isMilvusReachable() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 300);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
