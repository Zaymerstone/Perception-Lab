import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const registerSchema = z.object({
  age: z
    .string()
    .min(1, "Age is required")
    .refine(
      (val) => {
        const n = parseInt(val);
        return !isNaN(n) && n >= 18 && n <= 120;
      },
      { message: "Must be 18 or older" }
    ),
  gender: z.string().min(1, "Please select your gender"),
  vision: z.string().min(1, "Please select your vision status"),
  subjectCode: z
    .string()
    .trim()
    .min(1, "Subject code is required")
    .max(100, "Subject code is too long"),
});

type RegisterForm = z.infer<typeof registerSchema>;

const Register = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      age: "",
      gender: "",
      vision: "",
      subjectCode: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      // Check if subject_code is already used
      const { data: existing, error } = await supabase
        .from("experiment_results")
        .select("id")
        .eq("subject_code", data.subjectCode.trim())
        .limit(1);

      if (error) {
        toast({
          title: "Error",
          description: "Could not verify subject code. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (existing && existing.length > 0) {
        toast({
          title: "Subject code already used",
          description: "This subject code has already been registered. Please use a different one.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Registration complete",
        description: "You may now begin the experiment.",
      });
      navigate("/experiment", {
        state: {
          age: data.age,
          gender: data.gender,
          vision: data.vision,
          subjectCode: data.subjectCode.trim(),
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <main className="container max-w-lg mx-auto px-6 py-16 md:py-24">
        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to overview
        </button>

        <div className="mb-10">
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">
            Step 1 of 2
          </p>
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Participant Registration
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Please provide the following information before starting the
            experiment. All fields are required.
          </p>
        </div>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                {/* Age */}
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 25"
                          min={18}
                          max={120}
                          className="max-w-[140px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Gender */}
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Gender</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="max-w-[240px]">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="non-binary">Non-binary</SelectItem>
                          <SelectItem value="prefer-not-to-say">
                            Prefer not to say
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vision */}
                <FormField
                  control={form.control}
                  name="vision"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-foreground">
                        Vision Status
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="space-y-3"
                        >
                          {[
                            {
                              value: "normal",
                              label: "Normal vision (20/20)",
                            },
                            {
                              value: "corrected",
                              label:
                                "Corrected to normal (glasses / contacts)",
                            },
                            {
                              value: "impaired",
                              label: "Visual impairment",
                            },
                            {
                              value: "colorblind",
                              label: "Color vision deficiency",
                            },
                          ].map((option) => (
                            <div
                              key={option.value}
                              className="flex items-center space-x-3"
                            >
                              <RadioGroupItem
                                value={option.value}
                                id={option.value}
                              />
                              <Label
                                htmlFor={option.value}
                                className="font-normal text-foreground cursor-pointer"
                              >
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject Code */}
                <FormField
                  control={form.control}
                  name="subjectCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">
                        Subject Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="e.g. S001"
                          className="max-w-[320px]"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Enter the unique code provided to you by the researcher.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="h-12 px-8 rounded-xl gap-3 group"
                  >
                    {isSubmitting ? "Submitting…" : "Continue to Experiment"}
                    {!isSubmitting && (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Register;
