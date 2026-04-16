package com.smartcs.frontend;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class StaticFrontendRegressionTest {

    @Test
    void indexHtmlShouldExposeEnterpriseWorkbenchRegions() throws IOException {
        String html = readClasspathFile("static/index.html");

        assertThat(html)
                .contains("id=\"sessionList\"")
                .contains("id=\"sessionListMeta\"")
                .contains("id=\"sessionListStatus\"")
                .contains("id=\"appPageStatus\"")
                .contains("id=\"kbTableRegion\"")
                .contains("id=\"kbDetailPanel\"")
                .contains("id=\"kbWorkspaceStatus\"")
                .contains("id=\"perfMetrics\"")
                .contains("id=\"monitorWorkspaceStatus\"")
                .contains("id=\"activityFeedMeta\"")
                .contains("id=\"appAlertRegion\"")
                .contains("id=\"commandPalette\"")
                .contains("id=\"commandResultsMeta\"")
                .contains("id=\"commandResultStatus\"");
    }

    @Test
    void indexHtmlShouldKeepAccessibilityContracts() throws IOException {
        String html = readClasspathFile("static/index.html");

        assertThat(html)
                .contains("role=\"tablist\"")
                .contains("role=\"tab\"")
                .contains("aria-live=\"polite\"")
                .contains("aria-busy=\"false\"")
                .contains("aria-label=\"主功能导航\"")
                .contains("aria-controls=\"page-monitor\"")
                .contains("aria-current=\"page\"")
                .contains("aria-describedby=\"commandPaletteHint\"")
                .contains("aria-describedby=\"uploadModalHint\"")
                .contains("role=\"combobox\"")
                .contains("role=\"listbox\"")
                .contains("tabindex=\"-1\"");
    }

    @Test
    void appCssShouldDefineEnterpriseUiTokensAndStateSurfaces() throws IOException {
        String css = readClasspathFile("static/css/app.css");

        assertThat(css)
                .contains("--focus-ring")
                .contains("--skeleton-base")
                .contains(".ui-state")
                .contains(".app-alert-region")
                .contains("@media (prefers-reduced-motion: reduce)");
    }

    @Test
    void appJsShouldProvideRegressionHooksWithoutRawErrorLeaks() throws IOException {
        String js = readClasspathFile("static/js/app.js");

        assertThat(js)
                .contains("function renderSessionListLoading()")
                .contains("function renderKnowledgeTableLoading()")
                .contains("function renderPerfMetricsLoading()")
                .contains("function reportUiFailure(")
                .contains("function initSessionViewAccessibility()")
                .contains("function initPrimaryNavigationAccessibility()")
                .contains("function syncPrimaryNavigation(page)")
                .contains("function announcePageChange(page)")
                .contains("function initWorkspaceNavigationAccessibility()")
                .contains("function handleSessionListKeydown(event)")
                .contains("function handleKnowledgeTableKeydown(event)")
                .contains("function updateSessionListSummary()")
                .contains("function updateKnowledgeWorkspaceStatus()")
                .contains("function getFilteredActivities()")
                .contains("function updateMonitorWorkspaceStatus(customMessage = '')")
                .contains("function clearMonitorMetricFilters()")
                .contains("function handleCommandPaletteInputKeydown(event)")
                .contains("function syncCommandPaletteAccessibility(query, totalCount)")
                .contains("function previewCommandOption(index)")
                .contains("function trapFocusWithinModal(event)")
                .contains("function enforceActiveModalFocus(event)")
                .contains("function focusModalElement(modalId, selector = '')");

        assertThat(js)
                .doesNotContain("console.error")
                .doesNotContain("toast(json.message")
                .doesNotContain("appendMsg('ai', json.message")
                .doesNotContain("toast(e.message")
                .doesNotContain("appendMsg('ai', e.message");
    }

    @Test
    void staticAssetsShouldStayWithinFrontendPerformanceBudget() throws IOException {
        assertThat(readClasspathBytes("static/index.html").length).isLessThanOrEqualTo(60 * 1024);
        assertThat(readClasspathBytes("static/css/app.css").length).isLessThanOrEqualTo(70 * 1024);
        assertThat(readClasspathBytes("static/js/app.js").length).isLessThanOrEqualTo(130 * 1024);
    }

    private String readClasspathFile(String path) throws IOException {
        return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
    }

    private byte[] readClasspathBytes(String path) throws IOException {
        return new ClassPathResource(path).getContentAsByteArray();
    }
}
