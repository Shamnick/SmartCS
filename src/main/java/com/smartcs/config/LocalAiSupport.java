package com.smartcs.config;

import com.alibaba.fastjson2.JSON;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
public final class LocalAiSupport {

    private static final int EMBEDDING_DIMENSION = 1536;
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("([A-Za-z]{2,}[A-Za-z0-9_-]{4,})");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(1\\d{10})");

    private LocalAiSupport() {
    }

    public static boolean demoMode(String apiKey) {
        return apiKey == null
                || apiKey.isBlank()
                || apiKey.contains("your-deepseek-api-key")
                || apiKey.contains("sk-your");
    }

    public static ChatLanguageModel resilientChatModel(ChatLanguageModel primary, boolean forceDemo) {
        return messages -> {
            if (forceDemo || primary == null) {
                return Response.from(new AiMessage(generateDemoAnswer(messages)));
            }
            try {
                return primary.generate(messages);
            } catch (Exception e) {
                log.warn("远程Chat模型调用失败，自动回退到本地演示模式");
                return Response.from(new AiMessage(generateDemoAnswer(messages)));
            }
        };
    }

    public static StreamingChatLanguageModel resilientStreamingModel(StreamingChatLanguageModel primary,
                                                                     boolean forceDemo) {
        return (messages, handler) -> {
            try {
                if (forceDemo || primary == null) {
                    streamDemoAnswer(messages, handler);
                    return;
                }
                primary.generate(messages, handler);
            } catch (Exception e) {
                log.warn("远程Streaming模型调用失败，自动回退到本地演示模式");
                streamDemoAnswer(messages, handler);
            }
        };
    }

    public static EmbeddingModel resilientEmbeddingModel(EmbeddingModel primary, boolean forceDemo) {
        return new EmbeddingModel() {
            @Override
            public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
                if (forceDemo || primary == null) {
                    return Response.from(segments.stream()
                            .map(segment -> createEmbedding(segment.text()))
                            .collect(Collectors.toList()));
                }
                try {
                    return primary.embedAll(segments);
                } catch (Exception e) {
                    log.warn("远程Embedding模型调用失败，自动回退到本地向量化");
                    return Response.from(segments.stream()
                            .map(segment -> createEmbedding(segment.text()))
                            .collect(Collectors.toList()));
                }
            }

            @Override
            public int dimension() {
                return EMBEDDING_DIMENSION;
            }
        };
    }

    private static void streamDemoAnswer(List<ChatMessage> messages,
                                         StreamingResponseHandler<AiMessage> handler) {
        try {
            String answer = generateDemoAnswer(messages);
            for (String chunk : splitChunks(answer, 24)) {
                handler.onNext(chunk);
            }
            handler.onComplete(Response.from(new AiMessage(answer)));
        } catch (Exception e) {
            handler.onError(e);
        }
    }

    private static List<String> splitChunks(String text, int size) {
        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < text.length(); i += size) {
            chunks.add(text.substring(i, Math.min(i + size, text.length())));
        }
        return chunks;
    }

    private static String generateDemoAnswer(List<ChatMessage> messages) {
        String userText = latestUserText(messages);
        String systemText = latestSystemText(messages);

        if (userText == null || userText.isBlank()) {
            return "您好，我是企业智能客服助手，请输入您要咨询的问题。";
        }

        if (userText.startsWith("函数 ") && userText.contains("调用结果如下")) {
            return summarizeFunctionResult(userText);
        }

        if (systemText.contains("你可以调用以下业务函数")) {
            String functionCall = detectFunctionCall(userText);
            if (functionCall != null) {
                return functionCall;
            }
        }

        String ragContext = extractRagContext(systemText);
        if (!ragContext.isBlank() && !ragContext.contains("未在知识库中找到相关信息")) {
            return answerFromRag(userText, ragContext);
        }

        return defaultAnswer(userText);
    }

    private static String latestUserText(List<ChatMessage> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            ChatMessage message = messages.get(i);
            if (message instanceof UserMessage userMessage) {
                return userMessage.singleText();
            }
        }
        return "";
    }

    private static String latestSystemText(List<ChatMessage> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            ChatMessage message = messages.get(i);
            if (message instanceof SystemMessage systemMessage) {
                return systemMessage.text();
            }
        }
        return "";
    }

    private static String detectFunctionCall(String userText) {
        String normalized = userText.toLowerCase(Locale.ROOT);

        if (userText.contains("订单") || normalized.contains("order")) {
            Matcher matcher = ORDER_ID_PATTERN.matcher(userText);
            String orderId = matcher.find() ? matcher.group(1) : "ORD20240101";
            return "[CALL:query_order({\"orderId\":\"" + orderId + "\"})]";
        }

        if (userText.contains("会员") || userText.contains("账户") || userText.contains("用户信息") || userText.contains("手机号")) {
            Matcher phoneMatcher = PHONE_PATTERN.matcher(userText);
            String userId = phoneMatcher.find() ? phoneMatcher.group(1) : "U10086";
            return "[CALL:query_user_info({\"userId\":\"" + userId + "\"})]";
        }

        if (userText.contains("产品") || userText.contains("商品") || userText.contains("库存") || userText.contains("价格") || userText.contains("推荐")) {
            String keyword = userText.replace("\"", "").trim();
            if (keyword.isBlank()) {
                keyword = "热门产品";
            }
            return "[CALL:query_product({\"keyword\":\"" + keyword + "\"})]";
        }

        return null;
    }

    private static String summarizeFunctionResult(String prompt) {
        int firstLineBreak = prompt.indexOf('\n');
        String header = firstLineBreak > -1 ? prompt.substring(0, firstLineBreak) : prompt;
        String payload = firstLineBreak > -1 ? prompt.substring(firstLineBreak + 1).trim() : "";

        String functionName = "unknown";
        Matcher matcher = Pattern.compile("函数\\s+(\\w+)\\s+的调用结果如下").matcher(header);
        if (matcher.find()) {
            functionName = matcher.group(1);
        }

        Map<String, Object> data;
        try {
            data = JSON.parseObject(payload, Map.class);
        } catch (Exception e) {
            return "我已获取业务系统返回结果：\n" + payload;
        }

        return switch (functionName) {
            case "query_order" -> String.format("已为您查询订单 %s。当前订单状态为“%s”，订单金额为 %s 元，预计送达时间为 %s，物流单号为 %s。若您需要，我还可以继续帮您解读订单进度或售后规则。",
                    data.getOrDefault("orderId", "-"),
                    data.getOrDefault("status", "-"),
                    data.getOrDefault("amount", "-"),
                    data.getOrDefault("estimatedDelivery", "-"),
                    data.getOrDefault("trackingNumber", "-"));
            case "query_product" -> String.format("已为您查询产品信息。产品名称：%s，价格：%s 元，库存：%s，分类：%s。产品说明：%s。若您需要，我还可以继续为您做产品对比或推荐。",
                    data.getOrDefault("productName", "-"),
                    data.getOrDefault("price", "-"),
                    data.getOrDefault("stock", "-"),
                    data.getOrDefault("category", "-"),
                    data.getOrDefault("description", "-"));
            case "query_user_info" -> String.format("已为您查询用户信息。用户：%s，会员等级：%s，积分：%s，总订单数：%s，账户状态：%s。若您需要，我还可以继续帮您查询相关订单或会员权益。",
                    data.getOrDefault("username", "-"),
                    data.getOrDefault("memberLevel", "-"),
                    data.getOrDefault("points", "-"),
                    data.getOrDefault("totalOrders", "-"),
                    data.getOrDefault("status", "-"));
            case "search_knowledge" -> "根据知识检索结果，我为您整理如下：\n" + payload;
            default -> "我已获取业务系统返回结果：\n" + payload;
        };
    }

    private static String extractRagContext(String systemText) {
        int index = systemText.indexOf("【知识库检索结果】");
        if (index < 0) {
            return "";
        }
        String ragContext = systemText.substring(index).trim();
        int functionPromptIndex = ragContext.indexOf("你可以调用以下业务函数");
        if (functionPromptIndex > -1) {
            ragContext = ragContext.substring(0, functionPromptIndex).trim();
        }
        return ragContext;
    }

    private static String answerFromRag(String userText, String ragContext) {
        List<String> lines = ragContext.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .filter(line -> !line.startsWith("【知识库检索结果】"))
                .filter(line -> !line.startsWith("--- 文档片段"))
                .limit(4)
                .collect(Collectors.toList());

        String merged = String.join(" ", lines);
        if (merged.length() > 220) {
            merged = merged.substring(0, 220) + "...";
        }

        return "根据当前知识库检索结果，我为您整理如下：\n\n"
                + merged
                + "\n\n如果您希望，我还可以继续从这个主题里帮您提炼流程、注意事项或生成标准答复。";
    }

    private static String defaultAnswer(String userText) {
        if (userText.contains("介绍") || userText.contains("功能") || userText.contains("你是谁")) {
            return "我是企业智能客服助手，可为您提供三类服务：\n\n"
                    + "1. 企业知识问答：基于已上传知识库内容回答产品、政策、制度、流程等问题\n"
                    + "2. 业务数据查询：支持订单、产品、用户等信息查询\n"
                    + "3. 智能辅助服务：帮助归纳知识、生成标准答复、提升客服效率\n\n"
                    + "当前系统支持 RAG 检索增强、Function Calling、知识文档管理与监控面板。您可以继续直接提问，或先上传企业文档。";
        }

        if (userText.contains("退换货") || userText.contains("售后") || userText.contains("政策") || userText.contains("规则")) {
            return "当前知识库中还没有检索到与该问题强相关的企业资料。您可以先上传售后政策、产品手册或FAQ文档，我会基于企业私有知识为您提供更准确的回答。";
        }

        if (userText.contains("你好") || userText.contains("您好") || userText.contains("hi") || userText.contains("hello")) {
            return "您好，我是企业智能客服助手。您可以直接咨询产品、订单、售后政策、用户信息等问题，我会尽量给出准确、专业的回答。";
        }

        return "我已收到您的问题。当前系统未检索到足够的企业知识上下文，因此先给您一个通用建议：\n\n"
                + "- 如果是制度、政策、产品类问题，建议先上传企业知识文档\n"
                + "- 如果是订单、用户、产品实时数据问题，我可以调用业务接口进行查询\n"
                + "- 如果您愿意，可以把问题描述得更具体一些，我会继续为您分析\n\n"
                + "例如您可以这样问：\n"
                + "“查询订单 ORD20240101”\n"
                + "“退换货政策是什么”\n"
                + "“推荐几款热门产品”";
    }

    private static Embedding createEmbedding(String text) {
        float[] vector = new float[EMBEDDING_DIMENSION];
        if (text == null || text.isBlank()) {
            return Embedding.from(vector);
        }

        int[] codePoints = text.toLowerCase(Locale.ROOT).codePoints().toArray();
        for (int i = 0; i < codePoints.length; i++) {
            int cp = codePoints[i];
            int h1 = Math.floorMod(cp * 31 + i * 17, EMBEDDING_DIMENSION);
            vector[h1] += 1.0f;

            if (i < codePoints.length - 1) {
                int bigram = cp * 131 + codePoints[i + 1] * 17;
                int h2 = Math.floorMod(bigram, EMBEDDING_DIMENSION);
                vector[h2] += 1.5f;
            }
        }

        normalize(vector);
        return Embedding.from(vector);
    }

    private static void normalize(float[] vector) {
        double sum = 0D;
        for (float v : vector) {
            sum += v * v;
        }
        double norm = Math.sqrt(sum);
        if (norm == 0D) {
            return;
        }
        for (int i = 0; i < vector.length; i++) {
            vector[i] = (float) (vector[i] / norm);
        }
    }
}
