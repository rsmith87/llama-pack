from __future__ import annotations

from llama_pack.core.agent_tools.evals import ToolLoopEvalCase


def default_tool_loop_eval_cases() -> list[ToolLoopEvalCase]:
    return [
        ToolLoopEvalCase(
            id="two-step-tool-synthesis",
            system_prompt=(
                "Use the available tools when they are relevant. After gathering the requested facts, "
                "write a concise final answer that cites the facts you found."
            ),
            prompt=(
                "First inspect the status source, then inspect the details source, then combine both "
                "findings into one final answer."
            ),
            expected_tool_sequence=["read_status", "read_details"],
            expected_final_substrings=["green", "calibration window"],
        ),
        ToolLoopEvalCase(
            id="avoid-unneeded-tools",
            system_prompt="Answer directly when no tool is needed.",
            prompt="Reply with exactly: tool loop ready",
            expected_final_substrings=["tool loop ready"],
        ),
        ToolLoopEvalCase(
            id="linear-4-step-synthesis",
            system_prompt=(
                "Use the available tools in the requested order. After gathering all facts, "
                "write one concise final answer containing every fact token."
            ),
            prompt=(
                "Call read_step_1, read_step_2, read_step_3, and read_step_4 in order. "
                "Then summarize the four returned fact tokens."
            ),
            expected_tool_sequence=["read_step_1", "read_step_2", "read_step_3", "read_step_4"],
            expected_final_substrings=["alpha", "bravo", "charlie", "delta"],
            eval_tools=["read_step_1", "read_step_2", "read_step_3", "read_step_4"],
            max_iterations=6,
        ),
        ToolLoopEvalCase(
            id="linear-8-step-synthesis",
            system_prompt=(
                "Use the available tools in the requested order. Continue until all eight sources "
                "have been inspected, then stop and write a concise final answer containing every fact token."
            ),
            prompt=(
                "Call read_step_1 through read_step_8 in numeric order. "
                "Then summarize all eight returned fact tokens."
            ),
            expected_tool_sequence=[
                "read_step_1",
                "read_step_2",
                "read_step_3",
                "read_step_4",
                "read_step_5",
                "read_step_6",
                "read_step_7",
                "read_step_8",
            ],
            expected_final_substrings=["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"],
            eval_tools=[
                "read_step_1",
                "read_step_2",
                "read_step_3",
                "read_step_4",
                "read_step_5",
                "read_step_6",
                "read_step_7",
                "read_step_8",
            ],
            max_iterations=10,
        ),
        ToolLoopEvalCase(
            id="tool-error-recovery",
            system_prompt=(
                "If a tool reports an error, use the documented fallback tool once. "
                "Do not retry a failing tool when a fallback is available."
            ),
            prompt=(
                "Call unstable_primary first. If it fails, call stable_fallback and answer with the recovered fact."
            ),
            expected_tool_sequence=["unstable_primary", "stable_fallback"],
            expected_final_substrings=["fallback", "amber recovery token"],
            eval_tools=["unstable_primary", "stable_fallback"],
            scoring_mode="branch_path",
            expected_error_tools=["unstable_primary"],
            max_iterations=5,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="avoid-loop-trap",
            system_prompt=(
                "Stop once a tool says no more information is available. "
                "Do not repeat a lookup that has already answered."
            ),
            prompt=(
                "Call lookup_once. If it says there is no more information, stop and answer with the available fact."
            ),
            expected_tool_sequence=["lookup_once"],
            expected_final_substrings=["no more information"],
            eval_tools=["lookup_once"],
            scoring_mode="loop_stop",
            max_iterations=4,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="branching-decision",
            system_prompt=(
                "Use choose_route first. Follow only the route it returns. "
                "Do not inspect unrelated branches."
            ),
            prompt=(
                "Call choose_route. It will choose the correct branch. If it returns infra, "
                "call inspect_infra and answer with the infra finding."
            ),
            expected_tool_sequence=["choose_route", "inspect_infra"],
            expected_final_substrings=["infra", "network restart window"],
            eval_tools=["choose_route", "inspect_infra", "inspect_billing"],
            scoring_mode="branch_path",
            max_iterations=5,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="argument-repair",
            system_prompt=(
                "Extract exact tool arguments from the prompt. If a tool needs an identifier, "
                "call it once with the required identifier instead of guessing."
            ),
            prompt=(
                "Fetch ticket NX-42 by calling fetch_ticket with ticket_id NX-42. "
                "Then answer with the ticket owner and priority."
            ),
            expected_tool_sequence=["fetch_ticket"],
            expected_final_substrings=["NX-42", "Mira", "high"],
            eval_tools=["fetch_ticket"],
            max_iterations=4,
            required_tool_arguments={"fetch_ticket": {"ticket_id": "NX-42"}},
        ),
        ToolLoopEvalCase(
            id="parallel-fact-gathering",
            system_prompt=(
                "Gather all requested independent facts. The order does not matter, but each "
                "source should be called once and the final answer must include every fact."
            ),
            prompt=(
                "Call gather_fact_a, gather_fact_b, gather_fact_c, and gather_fact_d. "
                "Then answer with all four fact tokens."
            ),
            expected_tool_sequence=["gather_fact_a", "gather_fact_b", "gather_fact_c", "gather_fact_d"],
            expected_final_substrings=["redwood", "basalt", "aurora", "delta"],
            eval_tools=["gather_fact_a", "gather_fact_b", "gather_fact_c", "gather_fact_d"],
            scoring_mode="set_membership",
            max_iterations=6,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="subagent-delegation-simulation",
            system_prompt=(
                "Treat each helper as a separate agent node. Call each required helper once, "
                "preserve its role-specific result, and synthesize the final answer."
            ),
            prompt=(
                "Ask the planner, executor, reviewer, and verifier helpers for their outputs. "
                "Then combine their role-specific findings in one final answer."
            ),
            expected_tool_sequence=["ask_planner", "ask_executor", "ask_reviewer", "ask_verifier"],
            expected_final_substrings=["sequence tasks", "patch ready", "risk is low", "checks pass"],
            eval_tools=["ask_planner", "ask_executor", "ask_reviewer", "ask_verifier"],
            scoring_mode="set_membership",
            max_iterations=6,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="technical-design-doc-draft",
            category="real_world",
            system_prompt=(
                "You are drafting a concise technical design document from deterministic project sources. "
                "Use only relevant sources, call each relevant source at most once, avoid unrelated context, "
                "and include the required design sections in the final answer."
            ),
            prompt=(
                "Create a short technical design doc for adding durable tool-loop eval history. "
                "Inspect the design requirements, existing API contract, persistence constraints, "
                "frontend requirements, and rollout risks. Do not inspect unrelated context."
            ),
            expected_tool_sequence=[
                "read_design_requirements",
                "inspect_existing_api_contract",
                "inspect_persistence_constraints",
                "inspect_frontend_requirements",
                "read_rollout_risks",
            ],
            expected_final_substrings=[
                "Overview",
                "Goals",
                "Architecture",
                "Persistence",
                "Frontend",
                "Risk",
                "durable",
                "eval history",
                "controller",
                "node run",
                "benchmark",
                "grouped real-world scenarios",
                "schema churn",
            ],
            request_defaults={"max_tokens": 1200},
            eval_tools=[
                "read_design_requirements",
                "inspect_existing_api_contract",
                "inspect_persistence_constraints",
                "inspect_frontend_requirements",
                "read_rollout_risks",
                "lookup_unrelated_context",
            ],
            scoring_mode="set_membership",
            max_iterations=8,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="collaborative-notes-app-design",
            category="real_world",
            system_prompt=(
                "You are drafting a practical app design from deterministic project sources. "
                "Use only relevant sources, call each relevant source at most once, avoid registration/auth scope creep, "
                "and preserve the requested user_id and note_id relationship constraints."
            ),
            prompt=(
                "Create a concise technical design for a collaborative notes app. "
                "User account information and registration are not needed, but future relationships from notes to users "
                "must use user_id and note_id respectively. Inspect the product brief, data model constraints, "
                "API requirements, frontend requirements, and delivery risks. Do not inspect registration auth requirements."
            ),
            expected_tool_sequence=[
                "read_notes_app_product_brief",
                "inspect_notes_app_data_model",
                "inspect_notes_app_api_requirements",
                "inspect_notes_app_frontend_requirements",
                "read_notes_app_delivery_risks",
            ],
            expected_final_substrings=[
                "Overview",
                "Data model",
                "API",
                "Frontend",
                "Collaboration",
                "Risk",
                "notes",
                "collaborators",
                "user_id",
                "note_id",
                "registration",
                "auth scope creep",
            ],
            request_defaults={"max_tokens": 1200},
            eval_tools=[
                "read_notes_app_product_brief",
                "inspect_notes_app_data_model",
                "inspect_notes_app_api_requirements",
                "inspect_notes_app_frontend_requirements",
                "read_notes_app_delivery_risks",
                "inspect_registration_auth_requirements",
            ],
            scoring_mode="set_membership",
            max_iterations=8,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="benchmark-runtime-trace",
            category="real_world",
            system_prompt=(
                "You are tracing a runtime call path from deterministic project sources. "
                "Use only relevant source and test tools, call each relevant tool at most once, "
                "and ground every call-path edge in a file, line or quoted statement, and symbol handoff. "
                "If a claim is not directly verified by source, list it as unverified."
            ),
            prompt=(
                "Trace the runtime path for starting a benchmark run. Start at the FastAPI route that receives "
                "the request and end at the method that records each benchmark sample. Return the ordered call path "
                "with exact file paths and function/class names, the exact line or quoted statement where each "
                "handoff happens, every store/database method called along that path, which tests cover this path, "
                "and any claim you could not verify. Do not inspect unrelated UI context."
            ),
            expected_tool_sequence=[
                "read_benchmark_route_source",
                "read_benchmark_dependency_source",
                "read_benchmark_runner_source",
                "read_benchmark_inference_source",
                "read_benchmark_store_source",
                "read_benchmark_api_tests",
                "read_benchmark_store_tests",
            ],
            expected_final_substrings=[
                "llama_pack/api/routes/benchmarks.py",
                "start_runs",
                "store.get_definition",
                "store.create_run",
                "asyncio.create_task",
                "BenchmarkRunner.execute_run",
                "llama_pack/core/benchmarks/runner.py",
                "self._store.get_run",
                "self._store.get_definition",
                "self._store.update_run",
                "run_inference",
                "llama_pack/core/chat/inference_service.py",
                "proxy.chat_with_meta",
                "self._store.create_sample",
                "self._store.get_run_samples",
                "BenchmarkStoreOrm.create_sample",
                "tests/test_benchmark_api.py",
                "tests/test_benchmark_store_orm.py",
                "Unverified",
            ],
            required_tool_names=[
                "read_benchmark_route_source",
                "read_benchmark_dependency_source",
                "read_benchmark_runner_source",
                "read_benchmark_inference_source",
                "read_benchmark_store_source",
                "read_benchmark_api_tests",
                "read_benchmark_store_tests",
            ],
            required_final_substrings=[
                "from_symbol=benchmarks.start_runs to_symbol=BenchmarkStoreOrm.get_definition",
                "from_symbol=benchmarks.start_runs to_symbol=BenchmarkStoreOrm.create_run",
                "from_symbol=benchmarks.start_runs to_symbol=BenchmarkRunner.execute_run",
                "from_symbol=get_benchmark_runner to_symbol=request.app.state.benchmark_runner",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=BenchmarkStoreOrm.get_run",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=BenchmarkStoreOrm.get_definition",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=BenchmarkStoreOrm.update_run",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=run_inference",
                "from_symbol=run_inference to_symbol=ChatProxy.chat_with_meta",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=BenchmarkStoreOrm.create_sample",
                "from_symbol=BenchmarkRunner.execute_run to_symbol=BenchmarkStoreOrm.get_run_samples",
                "tests/test_benchmark_api.py::TestBenchmarkRunExecution::test_runner_completes_run_with_mocked_inference",
                "tests/test_benchmark_api.py::TestBenchmarkRunExecution::test_runner_marks_partial_on_mixed_failures",
                "tests/test_benchmark_store_orm.py::test_get_run_includes_samples",
            ],
            request_defaults={"max_tokens": 1400},
            eval_tools=[
                "read_benchmark_route_source",
                "read_benchmark_dependency_source",
                "read_benchmark_runner_source",
                "read_benchmark_inference_source",
                "read_benchmark_store_source",
                "read_benchmark_api_tests",
                "read_benchmark_store_tests",
                "read_benchmark_unrelated_ui",
            ],
            scoring_mode="set_membership",
            max_iterations=10,
            max_repeated_tool_calls=1,
        ),
    ]


