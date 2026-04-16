package com.smartcs.model.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一响应结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class R<T> {

    private int code;
    private String message;
    private T data;

    public static <T> R<T> ok(T data) {
        return R.<T>builder()
                .code(200)
                .message("success")
                .data(data)
                .build();
    }

    public static <T> R<T> ok() {
        return R.<T>builder()
                .code(200)
                .message("success")
                .build();
    }

    public static <T> R<T> fail(String message) {
        return R.<T>builder()
                .code(500)
                .message(message)
                .build();
    }

    public static <T> R<T> fail(int code, String message) {
        return R.<T>builder()
                .code(code)
                .message(message)
                .build();
    }
}
