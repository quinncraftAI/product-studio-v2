const fs = require('fs');

let code = fs.readFileSync('/Users/shaunak/.openclaw/workspace/product-studio-v2/app/studio/page.tsx', 'utf-8');

// Replace mode state with modes (array)
code = code.replace(
  `const [mode, setMode] = useState<GenerationMode["key"]>("white_bg_ecommerce");`,
  `const [selectedModes, setSelectedModes] = useState<Set<GenerationMode["key"]>>(new Set(["white_bg_ecommerce"]));`
);

// Replace mode preset buttons
code = code.replace(
  `onClick={() => setMode(m.key)}\n              className={\`w-full rounded-xl border p-4 text-left transition-all hover:border-black hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 \${m.key === mode ? "border-black bg-zinc-50 shadow-sm" : "border-zinc-200"}\`}`,
  `onClick={() => setSelectedModes(prev => {
                const next = new Set(prev);
                if (next.has(m.key) && next.size > 1) {
                  next.delete(m.key);
                } else {
                  next.add(m.key);
                }
                return next;
              })}
              className={\`w-full rounded-xl border p-4 text-left transition-all hover:border-black hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 \${selectedModes.has(m.key) ? "border-black bg-zinc-50 shadow-sm" : "border-zinc-200"}\`}`
);

// We need to also remove the <select> for modes in the Generation Controls
code = code.replace(
  /<label className="grid gap-1\.5 font-medium text-zinc-700">\s*Mode\s*<select[\s\S]*?<\/select>\s*<\/label>/m,
  `<div className="grid gap-1.5 font-medium text-zinc-700">
            Selected Modes
            <div className="flex flex-wrap gap-2">
              {MODES.filter(m => selectedModes.has(m.key)).map(m => (
                <span key={m.key} className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700">
                  {m.title}
                </span>
              ))}
            </div>
          </div>`
);

// Ratio select logic - currently `currentMode.ratios.map...`
code = code.replace(
  `{currentMode.ratios.map((r) => (\n                  <option key={r} value={r}>{r}</option>\n                ))}`,
  `{["1:1", "3:4", "4:3", "9:16", "16:9"].map((r) => (\n                  <option key={r} value={r}>{r}</option>\n                ))}`
);
code = code.replace(`const currentMode = useMemo(() => MODES.find((m) => m.key === mode)!, [mode]);`, ``);

// Jobs state
code = code.replace(
  `const [currentJob, setCurrentJob] = useState<any>(null);`,
  `const [activeJobs, setActiveJobs] = useState<any[]>([]);`
);

// Update polling effect
code = code.replace(
  `// Polling for job updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentJob && (currentJob.status === "queued" || currentJob.status === "running")) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(\`/api/generations/\${currentJob.id}\`);
          const json = await res.json();
          if (res.ok && json.data) {
            setCurrentJob(json.data);
            if (json.data.status === "completed" || json.data.status === "failed") {
              setResponse(\`Job \${json.data.status}!\`);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentJob]);`,
  `// Polling for job updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const pollingJobs = activeJobs.filter(j => j.status === "queued" || j.status === "running");
    
    if (pollingJobs.length > 0) {
      interval = setInterval(async () => {
        const updatedJobs = await Promise.all(
          activeJobs.map(async (job) => {
            if (job.status !== "queued" && job.status !== "running") return job;
            try {
              const res = await fetch(\`/api/generations/\${job.id}\`);
              const json = await res.json();
              if (res.ok && json.data) return json.data;
            } catch (err) {
              console.error("Polling error", err);
            }
            return job;
          })
        );
        setActiveJobs(updatedJobs);
        if (updatedJobs.every(j => j.status === "completed" || j.status === "failed")) {
          setResponse(\`All jobs finished!\`);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJobs]);`
);

// Lighting dropdown
const lightingDropdown = `Lighting
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select className="w-full sm:flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 transition-colors focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" value={lighting} onChange={(e) => setLighting(e.target.value)}>
                <option value="studio soft">Studio Soft</option>
                <option value="dramatic rim lighting">Dramatic Rim</option>
                <option value="natural sunlight">Natural Sunlight</option>
                <option value="neon cyberpunk">Neon Cyberpunk</option>
                <option value="cinematic moody">Cinematic Moody</option>
                <option value="ethereal high key">Ethereal High Key</option>
                <option value="harsh midday sun">Harsh Midday Sun</option>
                <option value="cybernetic bioluminescence">Bioluminescence</option>
                <option value="dutch master chiaroscuro">Chiaroscuro (Dark/Mood)</option>
              </select>
              <input className="w-full sm:flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 transition-colors focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" placeholder="Or custom..." value={lighting} onChange={(e) => setLighting(e.target.value)} />
            </div>`;

code = code.replace(
  /<label className="grid gap-1\.5 font-medium text-zinc-700">\s*Lighting[\s\S]*?<\/label>/m,
  `<div className="grid gap-1.5 font-medium text-zinc-700">${lightingDropdown}</div>`
);

// submitJob function
const oldSubmitJob = `  const submitJob = async () => {
    setIsSubmitting(true);
    setResponse("");
    setCurrentJob(null);

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          productId,
          campaignId: campaignId || undefined,
          mode,
          promptRaw,
          batchSize,
          params: { ratio, lighting, useEnhancer },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to queue generation job");

      setResponse(\`Started job: \${json.data.id}\`);
      setCurrentJob(json.data);
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };`;

const newSubmitJob = `  const submitJob = async () => {
    setIsSubmitting(true);
    setResponse("");
    setActiveJobs([]);

    try {
      const newJobs = [];
      for (const selectedMode of Array.from(selectedModes)) {
        const res = await fetch("/api/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            productId,
            campaignId: campaignId || undefined,
            mode: selectedMode,
            promptRaw,
            batchSize,
            params: { ratio, lighting, useEnhancer },
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to queue generation job");
        newJobs.push(json.data);
      }

      setResponse(\`Started \${newJobs.length} job(s).\`);
      setActiveJobs(newJobs);
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };`;

code = code.replace(oldSubmitJob, newSubmitJob);

// Handle approvals
code = code.replace(
  `  const handleApproval = async (outputId: string, newState: "approved" | "rejected" | "pending") => {
    // Optimistic update
    setCurrentJob((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        outputs: prev.outputs.map((out: any) => 
          out.id === outputId ? { ...out, approvalState: newState } : out
        ),
      };
    });`,
  `  const handleApproval = async (outputId: string, newState: "approved" | "rejected" | "pending") => {
    // Optimistic update
    setActiveJobs((prev: any[]) => prev.map(job => ({
      ...job,
      outputs: (job.outputs || []).map((out: any) => 
        out.id === outputId ? { ...out, approvalState: newState } : out
      ),
    })));`
);

code = code.replace(
  `  const handleBulkApprove = () => {
    if (!currentJob?.outputs) return;
    currentJob.outputs.forEach((out: any) => {
      if (out.approvalState !== "approved") {
        handleApproval(out.id, "approved");
      }
    });
  };`,
  `  const handleBulkApprove = () => {
    activeJobs.forEach(job => {
      (job.outputs || []).forEach((out: any) => {
        if (out.approvalState !== "approved") handleApproval(out.id, "approved");
      });
    });
  };`
);

code = code.replace(
  `  const handleBulkReject = () => {
    if (!currentJob?.outputs) return;
    currentJob.outputs.forEach((out: any) => {
      if (out.approvalState !== "rejected") {
        handleApproval(out.id, "rejected");
      }
    });
  };`,
  `  const handleBulkReject = () => {
    activeJobs.forEach(job => {
      (job.outputs || []).forEach((out: any) => {
        if (out.approvalState !== "rejected") handleApproval(out.id, "rejected");
      });
    });
  };`
);

code = code.replace(
  `      // Add the new child output to the local state so UI updates
      setCurrentJob((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          outputs: [json.data, ...prev.outputs], // prepend to show up as newest
        };
      });`,
  `      // Add the new child output to the local state so UI updates
      setActiveJobs((prev: any[]) => prev.map(job => {
        if (job.id === json.data.generationJobId) {
          return {
            ...job,
            outputs: [json.data, ...(job.outputs || [])],
          };
        }
        return job;
      }));`
);

// Review Board UI logic

code = code.replace(
  `{currentJob ? (
                <>
                  <span>Status: <strong className="font-medium text-zinc-700 capitalize">{currentJob.status}</strong></span>
                  <span className="text-zinc-300">•</span>
                  <span>Outputs: <strong className="font-medium text-zinc-700">{currentJob.outputs?.length || 0}/{currentJob.batchSize}</strong></span>
                  <span className="text-zinc-300">•</span>
                  <span className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-600" title="Estimated generation cost">
                    Est. Cost: ₹{(currentJob.batchSize * 3.5).toFixed(2)} / \${(currentJob.batchSize * 0.04).toFixed(2)}
                  </span>
                </>
              ) : (
                "Submit a job to see generation progress."
              )}`,
  `{activeJobs.length > 0 ? (
                <>
                  <span>Status: <strong className="font-medium text-zinc-700 capitalize">{activeJobs.some(j => j.status === 'running') ? 'Running' : activeJobs.every(j => j.status === 'completed') ? 'Completed' : 'Queued'}</strong></span>
                  <span className="text-zinc-300">•</span>
                  <span>Outputs: <strong className="font-medium text-zinc-700">{activeJobs.reduce((acc, j) => acc + (j.outputs?.length || 0), 0)}/{activeJobs.reduce((acc, j) => acc + j.batchSize, 0)}</strong></span>
                  <span className="text-zinc-300">•</span>
                  <span className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-600" title="Estimated generation cost">
                    Est. Cost: ₹{(activeJobs.reduce((acc, j) => acc + j.batchSize, 0) * 3.5).toFixed(2)} / \${(activeJobs.reduce((acc, j) => acc + j.batchSize, 0) * 0.04).toFixed(2)}
                  </span>
                </>
              ) : (
                "Submit a job to see generation progress."
              )}`
);

code = code.replace(
  `{currentJob && currentJob.status === "completed" && (`,
  `{activeJobs.length > 0 && activeJobs.every(j => j.status === "completed") && (`
);

code = code.replace(
  `{currentJob && currentJob.outputs && currentJob.outputs.length > 0 ? (
            (() => {
              // Group outputs by parent to only show leaf nodes
              const parentIds = new Set(currentJob.outputs.map((o: any) => o.parentOutputId).filter(Boolean));
              const leafOutputs = currentJob.outputs.filter((o: any) => !parentIds.has(o.id));
              
              return leafOutputs.map((out: any) => (`,
  `{activeJobs.length > 0 && activeJobs.some(j => (j.outputs || []).length > 0) ? (
            (() => {
              const allOutputs = activeJobs.flatMap(j => j.outputs || []);
              const parentIds = new Set(allOutputs.map((o: any) => o.parentOutputId).filter(Boolean));
              const leafOutputs = allOutputs.filter((o: any) => !parentIds.has(o.id));
              
              return leafOutputs.map((out: any) => (`
);

code = code.replace(
  `) : currentJob && (currentJob.status === "queued" || currentJob.status === "running") ? (
            Array.from({ length: currentJob.batchSize || batchSize }).map((_, idx) => (`,
  `) : activeJobs.length > 0 && activeJobs.some(j => j.status === "queued" || j.status === "running") ? (
            Array.from({ length: activeJobs.reduce((acc, j) => acc + j.batchSize, 0) }).map((_, idx) => (`
);

fs.writeFileSync('/Users/shaunak/.openclaw/workspace/product-studio-v2/app/studio/page.tsx', code);
