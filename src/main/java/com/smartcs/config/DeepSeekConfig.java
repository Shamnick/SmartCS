package com.smartcs.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * DeepSeek大模型配置 - 通过LangChain4j接入
 * DeepSeek兼容OpenAI API格式，使用OpenAI客户端连接
 */
@Slf4j
@Configuration
public class DeepSeekConfig {

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.base-url}")
    private String baseUrl;

    @Value("${deepseek.model}")
    private String model;

    @Value("${deepseek.embedding-model}")
    private String embeddingModel;

    @Value("${deepseek.temperature}")
    private Double temperature;

    @Value("${deepseek.max-tokens}")
    private Integer maxTokens;

    @Value("${deepseek.timeout}")
    private Integer timeout;

    /**
     * LangChain4j ChatLanguageModel - 用于同步问答
     */
    @Bean
    public ChatLanguageModel chatLanguageModel() {
        boolean demoMode = LocalAiSupport.demoMode(apiKey);
        if (demoMode) {
            log.warn("未检测到有效 DeepSeek API Key，启用本地演示聊天模型");
            return LocalAiSupport.resilientChatModel(null, true);
        }

        ChatLanguageModel remoteModel = OpenAiChatModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(model)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .timeout(Duration.ofSeconds(timeout))
                .logRequests(false)
                .logResponses(false)
                .build();
        return LocalAiSupport.resilientChatModel(remoteModel, false);
    }

    /**
     * LangChain4j StreamingChatLanguageModel - 用于流式问答
     */
    @Bean
    public StreamingChatLanguageModel streamingChatLanguageModel() {
        boolean demoMode = LocalAiSupport.demoMode(apiKey);
        if (demoMode) {
            return LocalAiSupport.resilientStreamingModel(null, true);
        }

        StreamingChatLanguageModel remoteModel = OpenAiStreamingChatModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(model)
                .temperature(temperature)
                .timeout(Duration.ofSeconds(timeout))
                .logRequests(false)
                .logResponses(false)
                .build();
        return LocalAiSupport.resilientStreamingModel(remoteModel, false);
    }

    /**
     * LangChain4j EmbeddingModel - 用于文档向量化
     */
    @Bean
    public EmbeddingModel embeddingModel() {
        boolean demoMode = LocalAiSupport.demoMode(apiKey);
        boolean remoteEmbeddingEnabled = !demoMode && embeddingModel != null && !embeddingModel.isBlank();
        if (!remoteEmbeddingEnabled) {
            log.info("未配置独立的远程Embedding模型，启用本地演示向量化模型");
            return LocalAiSupport.resilientEmbeddingModel(null, true);
        }

        EmbeddingModel remoteModel = OpenAiEmbeddingModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(embeddingModel)
                .timeout(Duration.ofSeconds(timeout))
                .build();
        return LocalAiSupport.resilientEmbeddingModel(remoteModel, false);
    }
}
