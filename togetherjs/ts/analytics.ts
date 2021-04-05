export class Analytics {
    activate(): void {
        const enable = TogetherJS.config.get("enableAnalytics");
        const code = TogetherJS.config.get("analyticsCode");
        TogetherJS.config.close("enableAnalytics");
        TogetherJS.config.close("analyticsCode");
        if(!(enable && code)) {
            return;
        }
        // This is intended to be global:
        const gaq = window._gaq || [];
        gaq.push(["_setAccount", code]);
        gaq.push(['_setDomainName', location.hostname]);
        gaq.push(["_trackPageview"]);
        window._gaq = gaq;

        (function() {
            const ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
            ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
            const s = document.getElementsByTagName('script')[0]; s.parentNode!.insertBefore(ga, s); // TODO !
        })();
    }
}

export const analytics = new Analytics();

//define(["util"], analyticsMain);
