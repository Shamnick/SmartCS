package com.smartcs.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 知识文档实体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeDocument {

    private String id;

    /**
     * 文档名称
     */
    private String documentName;

    /**
     * 文档内容
     */
    private String content;

    /**
     * 知识库分类
     */
    private String category;

    /**
     * 文档描述
     */
    private String description;

    /**
     * 文件路径
     */
    private String filePath;

    /**
     * 文件类型
     */
    private String fileType;

    /**
     * 分片数量
     */
    private int chunkCount;

    /**
     * 向量化状态: PENDING, PROCESSING, COMPLETED, FAILED
     */
    @Builder.Default
    private String status = "PENDING";

    /**
     * 创建时间
     */
    @Builder.Default
    private LocalDateTime createTime = LocalDateTime.now();

    /**
     * 更新时间
     */
    @Builder.Default
    private LocalDateTime updateTime = LocalDateTime.now();
}
