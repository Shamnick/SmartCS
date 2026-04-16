package com.smartcs.service.rag;

import com.smartcs.model.entity.KnowledgeDocument;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.DocumentParser;
import dev.langchain4j.data.document.parser.apache.tika.ApacheTikaDocumentParser;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 文档处理器 - 负责文档解析、分片
 */
@Slf4j
@Service
public class DocumentProcessor {

    @Value("${rag.chunk-size}")
    private int chunkSize;

    @Value("${rag.chunk-overlap}")
    private int chunkOverlap;

    private final DocumentParser documentParser = new ApacheTikaDocumentParser();

    /**
     * 解析文档 - 支持PDF、Word、TXT等格式
     */
    public Document parseDocument(InputStream inputStream, String documentName) {
        log.info("开始解析文档: {}", documentName);
        try {
            Document document = documentParser.parse(inputStream);
            document.metadata().put("document_name", documentName);
            log.info("文档解析完成: {}, 内容长度: {}", documentName, document.text().length());
            return document;
        } catch (Exception e) {
            log.error("文档解析失败: {}", documentName, e);
            throw new RuntimeException("文档解析失败: " + documentName, e);
        }
    }

    /**
     * 文档分片 - 将长文档拆分为适合Embedding的文本段
     */
    public List<TextSegment> splitDocument(Document document) {
        log.info("开始文档分片, chunkSize={}, overlap={}", chunkSize, chunkOverlap);
        List<TextSegment> segments = DocumentSplitters
                .recursive(chunkSize, chunkOverlap)
                .split(document);
        log.info("文档分片完成, 共{}个片段", segments.size());
        return segments;
    }

    /**
     * 异步处理文档 - 解析 + 分片
     */
    @Async("documentExecutor")
    public CompletableFuture<List<TextSegment>> processDocumentAsync(InputStream inputStream, String documentName) {
        Document document = parseDocument(inputStream, documentName);
        List<TextSegment> segments = splitDocument(document);
        return CompletableFuture.completedFuture(segments);
    }

    /**
     * 从纯文本创建文档并分片
     */
    public List<TextSegment> processTextContent(String content, String documentName, String category) {
        Document document = Document.from(content);
        document.metadata().put("document_name", documentName);
        document.metadata().put("category", category);
        return splitDocument(document);
    }
}
