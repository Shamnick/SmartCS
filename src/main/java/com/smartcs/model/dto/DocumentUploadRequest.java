package com.smartcs.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文档上传请求DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUploadRequest {

    /**
     * 文档名称
     */
    private String documentName;

    /**
     * 知识库分类
     */
    private String category;

    /**
     * 文档描述
     */
    private String description;
}
