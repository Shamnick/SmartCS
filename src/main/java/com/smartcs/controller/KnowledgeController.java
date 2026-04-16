package com.smartcs.controller;

import com.smartcs.model.common.R;
import com.smartcs.model.dto.DocumentUploadRequest;
import com.smartcs.model.entity.KnowledgeDocument;
import com.smartcs.service.KnowledgeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 知识库管理控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
public class KnowledgeController {

    private final KnowledgeService knowledgeService;

    /**
     * 上传文档到知识库
     */
    @PostMapping("/upload")
    public R<KnowledgeDocument> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentName", required = false) String documentName,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "description", required = false) String description) {

        log.info("上传文档: {}, 大小: {}", file.getOriginalFilename(), file.getSize());

        DocumentUploadRequest request = DocumentUploadRequest.builder()
                .documentName(documentName)
                .category(category)
                .description(description)
                .build();

        KnowledgeDocument doc = knowledgeService.uploadDocument(file, request);
        return R.ok(doc);
    }

    /**
     * 上传纯文本知识
     */
    @PostMapping("/text")
    public R<KnowledgeDocument> uploadTextKnowledge(@RequestBody Map<String, String> body) {
        String documentName = body.get("documentName");
        String content = body.get("content");
        String category = body.getOrDefault("category", "default");

        if (documentName == null || content == null) {
            return R.fail("documentName和content不能为空");
        }

        KnowledgeDocument doc = knowledgeService.uploadTextKnowledge(documentName, content, category);
        return R.ok(doc);
    }

    /**
     * 获取文档列表
     */
    @GetMapping("/documents")
    public R<List<KnowledgeDocument>> listDocuments() {
        return R.ok(knowledgeService.listDocuments());
    }

    /**
     * 获取文档详情
     */
    @GetMapping("/documents/{docId}")
    public R<KnowledgeDocument> getDocument(@PathVariable String docId) {
        KnowledgeDocument doc = knowledgeService.getDocument(docId);
        if (doc == null) {
            return R.fail(404, "文档不存在");
        }
        return R.ok(doc);
    }

    /**
     * 删除文档
     */
    @DeleteMapping("/documents/{docId}")
    public R<Void> deleteDocument(@PathVariable String docId) {
        boolean deleted = knowledgeService.deleteDocument(docId);
        if (!deleted) {
            return R.fail(404, "文档不存在");
        }
        return R.ok();
    }

    /**
     * 获取知识库统计信息
     */
    @GetMapping("/statistics")
    public R<Map<String, Object>> getStatistics() {
        return R.ok(knowledgeService.getStatistics());
    }
}
