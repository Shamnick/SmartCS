package com.smartcs.service;

import com.smartcs.model.dto.DocumentUploadRequest;
import com.smartcs.model.entity.KnowledgeDocument;
import com.smartcs.service.rag.DocumentProcessor;
import com.smartcs.service.rag.EmbeddingService;
import dev.langchain4j.data.segment.TextSegment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 知识库服务 - 管理知识文档的上传、向量化和检索
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private final DocumentProcessor documentProcessor;
    private final EmbeddingService embeddingService;

    /**
     * 文档存储(简化版 - 实际应使用数据库)
     */
    private final Map<String, KnowledgeDocument> documentStore = new ConcurrentHashMap<>();

    /**
     * 上传并处理文档
     */
    public KnowledgeDocument uploadDocument(MultipartFile file, DocumentUploadRequest request) {
        String docId = UUID.randomUUID().toString();
        String documentName = request.getDocumentName() != null ?
                request.getDocumentName() : file.getOriginalFilename();

        log.info("开始处理文档上传: {} ({})", documentName, file.getSize());

        KnowledgeDocument doc = KnowledgeDocument.builder()
                .id(docId)
                .documentName(documentName)
                .category(request.getCategory())
                .description(request.getDescription())
                .fileType(file.getContentType())
                .status("PROCESSING")
                .build();

        documentStore.put(docId, doc);

        // 异步处理文档
        processDocumentAsync(docId, file, documentName, request.getCategory());

        return doc;
    }

    /**
     * 异步处理文档 - 解析、分片、向量化
     */
    @Async("documentExecutor")
    public void processDocumentAsync(String docId, MultipartFile file,
                                      String documentName, String category) {
        try {
            InputStream inputStream = file.getInputStream();

            // 1. 解析文档
            var document = documentProcessor.parseDocument(inputStream, documentName);

            // 2. 文档分片
            List<TextSegment> segments = documentProcessor.splitDocument(document);

            // 为每个分片添加元数据
            segments.forEach(segment -> {
                segment.metadata().put("document_name", documentName);
                segment.metadata().put("category", category != null ? category : "default");
                segment.metadata().put("doc_id", docId);
            });

            // 3. 向量化并存储
            embeddingService.embedAndStoreBatch(segments, 50);

            // 4. 更新文档状态
            KnowledgeDocument doc = documentStore.get(docId);
            if (doc != null) {
                doc.setStatus("COMPLETED");
                doc.setChunkCount(segments.size());
                doc.setContent(document.text().substring(0,
                        Math.min(500, document.text().length())) + "...");
            }

            log.info("文档处理完成: {}, 共{}个分片", documentName, segments.size());

        } catch (Exception e) {
            log.error("文档处理失败: {}", documentName, e);
            KnowledgeDocument doc = documentStore.get(docId);
            if (doc != null) {
                doc.setStatus("FAILED");
            }
        }
    }

    /**
     * 上传纯文本知识
     */
    public KnowledgeDocument uploadTextKnowledge(String documentName, String content, String category) {
        String docId = UUID.randomUUID().toString();

        log.info("上传文本知识: {}", documentName);

        // 处理文本
        List<TextSegment> segments = documentProcessor.processTextContent(content, documentName, category);

        // 向量化存储
        embeddingService.embedAndStore(segments);

        KnowledgeDocument doc = KnowledgeDocument.builder()
                .id(docId)
                .documentName(documentName)
                .category(category)
                .content(content.substring(0, Math.min(500, content.length())))
                .chunkCount(segments.size())
                .status("COMPLETED")
                .build();

        documentStore.put(docId, doc);
        return doc;
    }

    /**
     * 获取文档信息
     */
    public KnowledgeDocument getDocument(String docId) {
        return documentStore.get(docId);
    }

    /**
     * 获取所有文档列表
     */
    public List<KnowledgeDocument> listDocuments() {
        return List.copyOf(documentStore.values());
    }

    /**
     * 删除文档
     */
    public boolean deleteDocument(String docId) {
        KnowledgeDocument removed = documentStore.remove(docId);
        if (removed != null) {
            log.info("删除文档: {}", removed.getDocumentName());
            return true;
        }
        return false;
    }

    /**
     * 获取知识库统计信息
     */
    public Map<String, Object> getStatistics() {
        long completed = documentStore.values().stream()
                .filter(d -> "COMPLETED".equals(d.getStatus())).count();
        long processing = documentStore.values().stream()
                .filter(d -> "PROCESSING".equals(d.getStatus())).count();
        long failed = documentStore.values().stream()
                .filter(d -> "FAILED".equals(d.getStatus())).count();
        int totalChunks = documentStore.values().stream()
                .mapToInt(KnowledgeDocument::getChunkCount).sum();

        return Map.of(
                "totalDocuments", documentStore.size(),
                "completed", completed,
                "processing", processing,
                "failed", failed,
                "totalChunks", totalChunks
        );
    }
}
