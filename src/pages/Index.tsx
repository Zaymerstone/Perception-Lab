import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Eye, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="container max-w-4xl mx-auto px-6 py-6 flex items-center gap-3">
          <Eye className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          <span className="text-lg font-medium tracking-tight text-foreground">
            Perception Lab
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Hero */}
        <div className="mb-16 md:mb-24">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">
            Research Study
          </p>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.1] mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Visual Perception
            <br />
            & Cognition Study
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Participate in our research exploring how the human visual system
            processes and interprets complex stimuli. Your contribution helps
            advance our understanding of perception and cognition.
          </p>
        </div>

        {/* Study Details */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              label: "Duration",
              value: "15–20 min",
              desc: "Complete at your own pace",
            },
            {
              label: "Format",
              value: "Online",
              desc: "Browser-based visual tasks",
            },
            {
              label: "Eligibility",
              value: "18+ years",
              desc: "Normal or corrected vision",
            },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                {item.label}
              </p>
              <p className="text-2xl font-semibold text-foreground tracking-tight">
                {item.value}
              </p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* About the Study */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-foreground mb-4 tracking-tight">
            About This Study
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              This experiment investigates the mechanisms underlying visual
              perception—how we detect, organize, and interpret visual
              information from our environment. You will be presented with a
              series of visual stimuli and asked to make judgments or responses
              based on what you observe.
            </p>
            <p>
              The study consists of a brief registration, followed by the main
              experiment. All tasks are completed within your web browser; no
              additional software is required.
            </p>
          </div>
        </section>

        {/* Privacy & Consent Card */}
        <Card className="mb-16 border-border/60 shadow-none">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-secondary p-2.5 mt-0.5">
                <Shield className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                  Privacy & Informed Consent
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Your participation is entirely voluntary. You may withdraw at
                    any time without penalty. All data collected is anonymized
                    and stored securely in accordance with institutional
                    guidelines.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
                      No personally identifiable information will be published.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
                      Data is used exclusively for academic research purposes.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
                      By proceeding, you confirm that you have read and agree to
                      these terms.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex flex-col items-center text-center">
          <Button
            onClick={() => navigate("/register")}
            size="lg"
            className="h-14 px-10 text-base font-medium rounded-xl gap-3 group"
          >
            Start Experiment
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            You will be asked to provide basic information before beginning.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-24">
        <div className="container max-w-4xl mx-auto px-6 py-8">
          <p className="text-xs text-muted-foreground">
            © 2026 Perception Lab. All rights reserved. For questions, contact
            the research team.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
