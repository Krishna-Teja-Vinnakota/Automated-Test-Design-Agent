"""API route handlers."""
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from bson import ObjectId

from app.config.database import get_database
from app.models.schemas import (
    JiraTicketResponse, SpecGenerateRequest, SpecModifyRequest, SpecEditRequest,
    SpecAcceptRequest, SpecResponse, ScenarioGenerateRequest, ScenarioModifyRequest,
    ScenarioEditRequest, ScenarioAcceptRequest, ScenarioNotifyRequest, ScenarioResponse,
    TestGenerateRequest, TestExecuteRequest, TestReviewRequest, TestResponse,
    TestExecutionResponse, TestReviewResponse, DeveloperFeedbackRequest, DeveloperFeedbackResponse
)
from app.api.dependencies import (
    get_jira_service, get_spec_interpreter, get_scenario_generator,
    get_test_code_generator, get_test_reviewer, get_test_executor, get_file_handler
)
from app.services.jira_service import JiraService
from app.agents.spec_interpreter import SpecInterpreterAgent
from app.agents.scenario_generator import ScenarioGeneratorAgent
from app.agents.test_code_generator import TestCodeGeneratorAgent
from app.agents.test_reviewer import TestReviewerAgent
from app.services.test_executor import TestExecutor
from app.services.file_handler import FileHandler

router = APIRouter()


# Jira Routes
@router.get("/jira/{ticket_id}", response_model=JiraTicketResponse)
async def fetch_jira_ticket(
    ticket_id: str,
    jira_service: JiraService = Depends(get_jira_service)
):
    """Fetch Jira ticket data (GET for backward compatibility)."""
    try:
        jira_data = jira_service.fetch_ticket(ticket_id)
        
        # Debug: Print all fields to console
        print("=" * 80)
        print(f"JIRA TICKET: {ticket_id}")
        print("=" * 80)
        fields = jira_data.get('fields', {})
        for field_name, field_value in fields.items():
            if 'accept' in field_name.lower() or 'criteria' in field_name.lower():
                print(f"🔍 FOUND ACCEPTANCE FIELD: {field_name}")
                print(f"   Value: {field_value}")
        print("=" * 80)
        
        return {
            "success": True,
            "jiraData": jira_data,
            "jiraTicketId": ticket_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fetch-jira")
async def fetch_jira_ticket_with_epic(
    request: Dict[str, Any],
    db = Depends(get_database),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Fetch Jira ticket data with optional epic context."""
    try:
        ticket_id = request.get("jiraTicketId")
        ticket_type = request.get("ticketType", "default")
        
        print("\n" + "="*80)
        print(f"📥 FETCH JIRA REQUEST")
        print(f"Ticket ID: {ticket_id}")
        print(f"Ticket Type: {ticket_type}")
        print("="*80)
        
        if not ticket_id:
            raise HTTPException(status_code=400, detail="jiraTicketId is required")
        
        # Fetch main ticket
        jira_data = jira_service.fetch_ticket(ticket_id)
        print(f"✅ Fetched ticket {ticket_id}")
        
        # Initialize epic variables
        epic_data = None
        epic_ticket_id = None
        sibling_tickets = None
        
        # If epic mode, try to fetch parent and siblings
        if ticket_type == "epic":
            print(f"🔍 Epic mode enabled - searching for parent epic and siblings...")
            epic_data, epic_ticket_id = jira_service.fetch_epic_for_ticket(ticket_id)
            
            if not epic_data:
                print(f"❌ No parent epic found for {ticket_id}")
                raise HTTPException(
                    status_code=400,
                    detail=f"No parent epic found for ticket {ticket_id}. Please use 'Standard Ticket' mode."
                )
            
            print(f"✅ Found parent epic: {epic_ticket_id}")
            epic_summary = epic_data.get('fields', {}).get('summary', 'N/A')
            print(f"   Epic Summary: {epic_summary}")
            
            # Fetch all sibling tickets (excluding the current one)
            sibling_tickets = jira_service.fetch_all_epic_children(epic_ticket_id, exclude_ticket_id=ticket_id)
            print(f"✅ Fetched {len(sibling_tickets)} sibling user stories as context")
        else:
            print(f"ℹ️  Standard mode - no epic context will be fetched")
        
        # Check if document already exists
        existing = await db.requirements.find_one({"jiraTicketId": ticket_id})
        
        if existing:
            # Update with epic data and siblings
            await db.requirements.update_one(
                {"jiraTicketId": ticket_id},
                {
                    "$set": {
                        "jiraData": jira_data,
                        "ticketType": ticket_type,
                        "epicData": epic_data,
                        "epicTicketId": epic_ticket_id,
                        "siblingTickets": sibling_tickets,
                        "timestamps.created": datetime.utcnow()
                    }
                }
            )
        else:
            # Create with epic data and siblings
            from app.models.requirements import RequirementDocument
            doc = RequirementDocument(
                jiraTicketId=ticket_id,
                jiraData=jira_data,
                ticketType=ticket_type,
                epicData=epic_data,
                epicTicketId=epic_ticket_id,
                siblingTickets=sibling_tickets,
                status="draft"
            )
            await db.requirements.insert_one(doc.dict())
        
        print(f"💾 Storing in MongoDB:")
        print(f"   - Epic context: {epic_ticket_id is not None}")
        print(f"   - Sibling tickets: {len(sibling_tickets) if sibling_tickets else 0}")
        print("="*80 + "\n")
        
        return {
            "success": True,
            "jiraTicketId": ticket_id,
            "jiraData": jira_data,
            "ticketType": ticket_type,
            "epicData": epic_data,
            "epicTicketId": epic_ticket_id,
            "siblingTicketsCount": len(sibling_tickets) if sibling_tickets else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in fetch-jira: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Spec Routes
@router.post("/spec/generate", response_model=SpecResponse)
async def generate_spec(
    request: SpecGenerateRequest,
    spec_agent: SpecInterpreterAgent = Depends(get_spec_interpreter),
    jira_service: JiraService = Depends(get_jira_service),
    db = Depends(get_database)
):
    """Generate spec from Jira ticket."""
    try:
        print("\n" + "="*80)
        print(f"📝 SPEC GENERATION REQUEST")
        print(f"Ticket ID: {request.jiraTicketId}")
        
        # Get requirement document if exists
        requirements_collection = db["requirements"]
        document = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        
        # Fetch Jira data
        jira_data = jira_service.fetch_ticket(request.jiraTicketId)
        
        # Get epic data and siblings from document if available
        epic_data = document.get('epicData') if document else None
        sibling_tickets = document.get('siblingTickets', []) if document else []
        
        if epic_data:
            epic_id = document.get('epicTicketId', 'Unknown')
            epic_summary = epic_data.get('fields', {}).get('summary', 'N/A')
            print(f"🎯 Epic Context ENABLED")
            print(f"   Epic ID: {epic_id}")
            print(f"   Epic Summary: {epic_summary}")
            print(f"   Sibling tickets: {len(sibling_tickets)}")
        else:
            print(f"ℹ️  No epic context available")
        
        print(f"🤖 Generating spec with epic context: {epic_data is not None}, siblings: {len(sibling_tickets)}")
        
        # Generate spec with epic context and siblings
        spec = spec_agent.generate_spec(jira_data, epic_data, sibling_tickets)
        
        print(f"✅ Spec generated successfully")
        print("="*80 + "\n")
        
        # Store Jira data only (spec stored only on accept)
        # This allows us to regenerate/modify without losing Jira context
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "jiraData": jira_data,
                    "draftSpec": spec,  # Store as draft, not final
                    "timestamps.specGenerated": datetime.utcnow()
                },
                "$setOnInsert": {
                    "jiraTicketId": request.jiraTicketId,
                    "status": "draft",
                    "timestamps.created": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        return {
            "success": True,
            "spec": spec,
            "jiraTicketId": request.jiraTicketId
        }
    except Exception as e:
        import traceback
        error_detail = str(e)
        print(f"Error in generate_spec: {error_detail}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/spec/modify", response_model=SpecResponse)
async def modify_spec(
    request: SpecModifyRequest,
    spec_agent: SpecInterpreterAgent = Depends(get_spec_interpreter),
    jira_service: JiraService = Depends(get_jira_service),
    db = Depends(get_database)
):
    """Modify spec with user prompt."""
    try:
        print("\n" + "="*80)
        print(f"✏️  SPEC MODIFICATION REQUEST")
        print(f"Ticket ID: {request.jiraTicketId}")
        print(f"User Prompt: {request.userPrompt[:100]}...")
        
        # Get current spec and Jira data
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        jira_data = requirement.get("jiraData", {})
        current_spec = requirement.get("draftSpec") or requirement.get("spec", {})
        epic_data = requirement.get("epicData")
        sibling_tickets = requirement.get('siblingTickets', [])
        
        if epic_data:
            epic_id = requirement.get('epicTicketId', 'Unknown')
            print(f"🎯 Epic Context INCLUDED in modification")
            print(f"   Epic ID: {epic_id}")
            print(f"   Sibling tickets: {len(sibling_tickets)}")
        else:
            print(f"ℹ️  No epic context in modification")
        
        # Extract Jira summary and description for context
        jira_summary = jira_data.get('fields', {}).get('summary', '')
        jira_description = jira_data.get('fields', {}).get('description', {})
        
        # Build epic context if available
        epic_context = ""
        if epic_data:
            epic_summary = epic_data.get('fields', {}).get('summary', '')
            epic_description = epic_data.get('fields', {}).get('description', {})
            epic_context = f"""
EPIC CONTEXT (Strategic Goal):
Epic ID: {epic_data.get('key', 'N/A')}
Epic Summary: {epic_summary}
Epic Description: {epic_description}

"""
        
        # Build sibling tickets context summary
        siblings_context = ""
        if sibling_tickets and len(sibling_tickets) > 0:
            siblings_context = f"\nRELATED USER STORIES ({len(sibling_tickets)} sibling tickets under same epic):\n"
            for i, sibling in enumerate(sibling_tickets[:5], 1):
                sibling_key = sibling.get('key', 'N/A')
                sibling_summary = sibling.get('fields', {}).get('summary', 'N/A')
                siblings_context += f"{i}. {sibling_key}: {sibling_summary}\n"
            if len(sibling_tickets) > 5:
                siblings_context += f"... and {len(sibling_tickets) - 5} more\n"
            siblings_context += "\n"
        
        # Build modification prompt with full context (Epic + Siblings + Jira + Spec + User Prompt)
        prompt = f"""Modify the following specification based on user request.

{epic_context}{siblings_context}JIRA TICKET CONTEXT:
- Summary: {jira_summary}
- Description: {jira_description}

CURRENT SPECIFICATION:
{current_spec}

USER MODIFICATION REQUEST: {request.userPrompt}

Based on the {"epic context, " if epic_data else ""}Jira requirements and user's modification request, update the specification accordingly.
Return the modified specification in the same JSON format as the current specification."""
        
        from app.services.llm_service import LLMService
        llm = LLMService()
        modified_spec = llm.generate_json(prompt)
        
        # Update draft spec (not final until accepted)
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {"$set": {"draftSpec": modified_spec, "timestamps.specModified": datetime.utcnow()}}
        )
        
        print(f"✅ Spec modified successfully")
        print("="*80 + "\n")
        
        return {
            "success": True,
            "spec": modified_spec,
            "jiraTicketId": request.jiraTicketId
        }
    except Exception as e:
        print(f"❌ Error in spec modification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spec/regenerate", response_model=SpecResponse)
async def regenerate_spec(
    request: SpecGenerateRequest,
    spec_agent: SpecInterpreterAgent = Depends(get_spec_interpreter),
    jira_service: JiraService = Depends(get_jira_service),
    db = Depends(get_database)
):
    """Regenerate spec from Jira."""
    return await generate_spec(request, spec_agent, jira_service, db)


@router.post("/spec/accept")
async def accept_spec(
    request: SpecAcceptRequest,
    db = Depends(get_database)
):
    """Accept and store spec in MongoDB (only now is it finalized)."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        # Check for draft spec first, then fall back to already accepted spec
        draft_spec = requirement.get("draftSpec")
        existing_spec = requirement.get("spec")
        
        if draft_spec:
            # Move draft spec to final spec
            await requirements_collection.update_one(
                {"jiraTicketId": request.jiraTicketId},
                {
                    "$set": {
                        "spec": draft_spec,  # Finalize the spec
                        "status": "spec_accepted",
                        "timestamps.specAccepted": datetime.utcnow()
                    },
                    "$unset": {"draftSpec": ""}  # Remove draft
                }
            )
            return {"success": True, "message": "Spec accepted and stored in MongoDB"}
        elif existing_spec:
            # Spec already accepted, just update status
            await requirements_collection.update_one(
                {"jiraTicketId": request.jiraTicketId},
                {
                    "$set": {
                        "status": "spec_accepted",
                        "timestamps.specAccepted": datetime.utcnow()
                    }
                }
            )
            return {"success": True, "message": "Spec already accepted"}
        else:
            raise HTTPException(status_code=400, detail="No spec to accept. Generate spec first.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spec/edit")
async def edit_spec(
    request: SpecEditRequest,
    db = Depends(get_database)
):
    """Save manually edited spec (as draft until accepted)."""
    try:
        requirements_collection = db["requirements"]
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {"$set": {"draftSpec": request.editedSpec, "timestamps.specEdited": datetime.utcnow()}}
        )
        return {"success": True, "message": "Spec edited and saved as draft"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Scenario Routes
@router.post("/scenarios/generate", response_model=ScenarioResponse)
async def generate_scenarios(
    request: ScenarioGenerateRequest,
    scenario_agent: ScenarioGeneratorAgent = Depends(get_scenario_generator),
    db = Depends(get_database)
):
    """Generate test scenarios (with context: Epic + Jira + Spec)."""
    try:
        print("\n" + "="*80)
        print(f"🎬 SCENARIO GENERATION REQUEST")
        print(f"Ticket ID: {request.jiraTicketId}")
        
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        spec = requirement.get("spec")
        if not spec:
            raise HTTPException(status_code=400, detail="Spec must be accepted first")
        
        jira_data = requirement.get("jiraData", {})
        epic_data = requirement.get("epicData")
        sibling_tickets = requirement.get('siblingTickets', [])
        
        if epic_data:
            epic_id = requirement.get('epicTicketId', 'Unknown')
            epic_summary = epic_data.get('fields', {}).get('summary', 'N/A')
            print(f"🎯 Epic Context ENABLED")
            print(f"   Epic ID: {epic_id}")
            print(f"   Epic Summary: {epic_summary}")
            print(f"   Sibling tickets: {len(sibling_tickets)}")
        else:
            print(f"ℹ️  No epic context available")
        
        print(f"🤖 Generating scenarios with epic context: {epic_data is not None}, siblings: {len(sibling_tickets)}")
        
        # Pass epic data and siblings to scenario generator
        scenarios = scenario_agent.generate_scenarios(jira_data, spec, epic_data, sibling_tickets)
        
        print(f"✅ Generated {len(scenarios)} scenarios")
        print("="*80 + "\n")
        
        # Store as draft scenarios (not final until accepted)
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "draftScenarios": scenarios,
                    "timestamps.scenariosGenerated": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "scenarios": scenarios,
            "jiraTicketId": request.jiraTicketId
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/modify", response_model=ScenarioResponse)
async def modify_scenarios(
    request: ScenarioModifyRequest,
    scenario_agent: ScenarioGeneratorAgent = Depends(get_scenario_generator),
    db = Depends(get_database)
):
    """Modify scenarios with user prompt (includes full context: Epic + Jira + Spec + Scenarios + User Prompt)."""
    try:
        print("\n" + "="*80)
        print(f"✏️  SCENARIO MODIFICATION REQUEST")
        print(f"Ticket ID: {request.jiraTicketId}")
        print(f"User Prompt: {request.userPrompt[:100]}...")
        
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        jira_data = requirement.get("jiraData", {})
        spec = requirement.get("spec", {})
        current_scenarios = requirement.get("draftScenarios") or requirement.get("testScenarios", [])
        epic_data = requirement.get("epicData")
        sibling_tickets = requirement.get('siblingTickets', [])
        
        if epic_data:
            epic_id = requirement.get('epicTicketId', 'Unknown')
            print(f"🎯 Epic Context INCLUDED in modification")
            print(f"   Epic ID: {epic_id}")
            print(f"   Sibling tickets: {len(sibling_tickets)}")
        else:
            print(f"ℹ️  No epic context in modification")
        
        # Extract Jira context
        jira_summary = jira_data.get('fields', {}).get('summary', '')
        jira_description = jira_data.get('fields', {}).get('description', {})
        
        # Build epic context if available
        epic_context = ""
        if epic_data:
            epic_summary = epic_data.get('fields', {}).get('summary', '')
            epic_description = epic_data.get('fields', {}).get('description', {})
            epic_context = f"""
EPIC CONTEXT (Strategic Goal):
Epic ID: {epic_data.get('key', 'N/A')}
Epic Summary: {epic_summary}
Epic Description: {epic_description}

"""
        
        # Build sibling tickets context summary
        siblings_context = ""
        if sibling_tickets and len(sibling_tickets) > 0:
            siblings_context = f"\nRELATED USER STORIES ({len(sibling_tickets)} sibling tickets):\n"
            for i, sibling in enumerate(sibling_tickets[:5], 1):
                sibling_key = sibling.get('key', 'N/A')
                sibling_summary = sibling.get('fields', {}).get('summary', 'N/A')
                siblings_context += f"{i}. {sibling_key}: {sibling_summary}\n"
            if len(sibling_tickets) > 5:
                siblings_context += f"... and {len(sibling_tickets) - 5} more\n"
            siblings_context += "\n"
        
        # Build modification prompt with FULL context (Epic + Siblings + Jira + Spec + Scenarios + User Prompt)
        prompt = f"""Modify the following test scenarios based on user request.

{epic_context}{siblings_context}JIRA TICKET CONTEXT:
- Summary: {jira_summary}
- Description: {jira_description}

SPECIFICATION:
{spec}

CURRENT TEST SCENARIOS:
{current_scenarios}

USER MODIFICATION REQUEST: {request.userPrompt}

Based on the {"epic context, " if epic_data else ""}Jira requirements, specification, and user's modification request, update the test scenarios accordingly.
Return modified scenarios as a JSON array in the same format as the current scenarios."""
        
        from app.services.llm_service import LLMService
        llm = LLMService()
        modified_scenarios = llm.generate_json(prompt)
        
        if isinstance(modified_scenarios, list):
            scenarios = modified_scenarios
        elif isinstance(modified_scenarios, dict) and "scenarios" in modified_scenarios:
            scenarios = modified_scenarios["scenarios"]
        else:
            scenarios = current_scenarios
        
        # Update draft scenarios (not final until accepted)
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {"$set": {"draftScenarios": scenarios, "timestamps.scenariosModified": datetime.utcnow()}}
        )
        
        print(f"✅ Scenarios modified successfully ({len(scenarios)} scenarios)")
        print("="*80 + "\n")
        
        return {
            "success": True,
            "scenarios": scenarios,
            "jiraTicketId": request.jiraTicketId
        }
    except Exception as e:
        print(f"❌ Error in scenario modification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/regenerate", response_model=ScenarioResponse)
async def regenerate_scenarios(
    request: ScenarioGenerateRequest,
    scenario_agent: ScenarioGeneratorAgent = Depends(get_scenario_generator),
    db = Depends(get_database)
):
    """Regenerate scenarios."""
    return await generate_scenarios(request, scenario_agent, db)


@router.post("/scenarios/accept")
async def accept_scenarios(
    request: ScenarioAcceptRequest,
    db = Depends(get_database)
):
    """Accept and store scenarios in MongoDB (only now are they finalized)."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        # Check for draft scenarios first, then fall back to already accepted scenarios
        draft_scenarios = requirement.get("draftScenarios")
        existing_scenarios = requirement.get("testScenarios")
        
        if draft_scenarios:
            # Move draft scenarios to final
            await requirements_collection.update_one(
                {"jiraTicketId": request.jiraTicketId},
                {
                    "$set": {
                        "testScenarios": draft_scenarios,  # Finalize scenarios
                        "status": "scenarios_accepted",
                        "timestamps.scenariosAccepted": datetime.utcnow()
                    },
                    "$unset": {"draftScenarios": ""}  # Remove draft
                }
            )
            return {"success": True, "message": "Scenarios accepted and stored in MongoDB"}
        elif existing_scenarios:
            # Scenarios already accepted, just update status
            await requirements_collection.update_one(
                {"jiraTicketId": request.jiraTicketId},
                {
                    "$set": {
                        "status": "scenarios_accepted",
                        "timestamps.scenariosAccepted": datetime.utcnow()
                    }
                }
            )
            return {"success": True, "message": "Scenarios already accepted"}
        else:
            raise HTTPException(status_code=400, detail="No scenarios to accept. Generate scenarios first.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/edit")
async def edit_scenarios(
    request: ScenarioEditRequest,
    db = Depends(get_database)
):
    """Save manually edited scenarios (as draft until accepted)."""
    try:
        requirements_collection = db["requirements"]
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {"$set": {"draftScenarios": request.editedScenarios, "timestamps.scenariosEdited": datetime.utcnow()}}
        )
        return {"success": True, "message": "Scenarios edited and saved as draft"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/notify")
async def notify_developer(
    request: ScenarioNotifyRequest,
    jira_service: JiraService = Depends(get_jira_service),
    db = Depends(get_database)
):
    """Assign Jira ticket to developer and add comment."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        # Check for scenarios in either draft or final form
        scenarios = requirement.get("testScenarios") or requirement.get("draftScenarios")
        if not scenarios:
            raise HTTPException(status_code=400, detail="Scenarios must be generated first")
        
        # Accept scenarios if not already accepted (move draft to final)
        draft_scenarios = requirement.get("draftScenarios")
        if draft_scenarios:
            await requirements_collection.update_one(
                {"jiraTicketId": request.jiraTicketId},
                {
                    "$set": {
                        "testScenarios": draft_scenarios,
                        "status": "scenarios_accepted",
                        "timestamps.scenariosAccepted": datetime.utcnow()
                    },
                    "$unset": {"draftScenarios": ""}
                }
            )
            # Refresh requirement data
            requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        
        # Assign ticket to developer
        try:
            jira_service.assign_ticket(request.jiraTicketId, request.developerEmail)
        except Exception as e:
            print(f"Warning: Could not assign ticket: {e}")
        
        # Add comment with requirements
        comment = jira_service.format_requirements_comment(
            requirement.get("jiraData", {}),
            requirement.get("spec", {}),
            requirement.get("testScenarios", [])
        )
        jira_service.add_comment(request.jiraTicketId, comment)
        
        # Update requirement
        requirements_collection = db["requirements"]
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "assignedDeveloperEmail": request.developerEmail,
                    "timestamps.developerAssigned": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Ticket assigned to developer and requirements added as comment",
            "jiraTicketId": request.jiraTicketId,
            "assignedTo": request.developerEmail
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Requirement Data Route (for Test Existing flow)
@router.get("/requirements/{jira_ticket_id}")
async def get_requirement_data(
    jira_ticket_id: str,
    db = Depends(get_database)
):
    """Fetch stored requirement data (specs, scenarios) by JIRA ID."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": jira_ticket_id})
        
        if not requirement:
            raise HTTPException(status_code=404, detail=f"No data found for JIRA ID: {jira_ticket_id}")
        
        spec = requirement.get("spec")
        scenarios = requirement.get("testScenarios")
        
        if not spec or not scenarios:
            raise HTTPException(
                status_code=400, 
                detail=f"JIRA ID {jira_ticket_id} exists but specs/scenarios are not complete. Please complete the requirement flow first."
            )
        
        return {
            "success": True,
            "jiraTicketId": jira_ticket_id,
            "jiraData": requirement.get("jiraData", {}),
            "spec": spec,
            "testScenarios": scenarios,
            "status": requirement.get("status", "unknown")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Test Routes
@router.post("/tests/generate", response_model=TestResponse)
async def generate_test_code(
    jiraTicketId: str = Form(...),
    type: str = Form(...),
    framework: str = Form(default=None),
    testCategories: str = Form(default=None),  # comma-separated: "unit,integration"
    files: List[UploadFile] = File(default=[]),
    developerCode: str = Form(default=None),  # Alternative to file upload - paste code directly
    test_agent: TestCodeGeneratorAgent = Depends(get_test_code_generator),
    file_handler: FileHandler = Depends(get_file_handler),
    db = Depends(get_database)
):
    """Generate test code (Frontend: Playwright/Cypress, Backend: Jest)."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found. Please ensure specs and scenarios exist for this JIRA ID.")
        
        spec = requirement.get("spec")
        scenarios = requirement.get("testScenarios")
        jira_data = requirement.get("jiraData", {})
        
        if not spec or not scenarios:
            raise HTTPException(status_code=400, detail="Spec and scenarios must be accepted first. Please complete the requirement flow.")
        
        # Handle developer code - either from files or direct paste
        developer_code = ""
        saved_files = []
        
        if developerCode and developerCode.strip():
            # Use directly pasted code
            developer_code = developerCode
        elif files:
            # Use uploaded files
            saved_files = await file_handler.save_uploaded_files(files)
            developer_code = "\n\n".join([f.get("content", "") for f in saved_files])
        
        # Parse test categories for backend
        test_categories_list = None
        if testCategories:
            test_categories_list = [cat.strip() for cat in testCategories.split(",")]
        
        # Set default framework based on type
        if framework is None:
            framework = "playwright" if type == "frontend" else "jest"
        
        # Generate test code with full context
        test_code = test_agent.generate_test_code(
            jira_data, 
            spec, 
            scenarios, 
            developer_code, 
            type,
            framework,
            test_categories_list
        )
        
        # Determine filename based on framework
        if type == "frontend":
            if framework == "cypress":
                filename = "test.cy.js"
            else:  # playwright
                filename = "test.spec.ts"
        else:  # backend with jest
            filename = "test.spec.js"
        
        # Update requirement
        await requirements_collection.update_one(
            {"jiraTicketId": jiraTicketId},
            {
                "$set": {
                    "generatedTestCode": test_code,
                    "testType": type,
                    "testFramework": framework,
                    "testCategories": test_categories_list,
                    "developerFiles": [f.get("filename") for f in saved_files] if saved_files else [],
                    "status": "tests_generated",
                    "timestamps.testsGenerated": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "testCode": test_code,
            "framework": framework,
            "testType": type,
            "fileName": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tests/execute", response_model=TestExecutionResponse)
async def execute_tests(
    request: TestExecuteRequest,
    test_executor: TestExecutor = Depends(get_test_executor),
    db = Depends(get_database)
):
    """Execute generated test code (Playwright for frontend, Pytest for backend)."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        test_code = requirement.get("generatedTestCode")
        test_type = requirement.get("testType")
        framework = requirement.get("testFramework", "playwright" if test_type == "frontend" else "pytest")
        
        if not test_code:
            raise HTTPException(status_code=400, detail="Test code must be generated first")
        
        # Get target URL from request or use default
        if test_type == "frontend":
            target_url = request.targetUrl or "http://localhost:5173"
        else:
            target_url = request.targetUrl or "http://localhost:3001"
        
        # Execute tests with appropriate framework
        if test_type == "frontend":
            results = test_executor.execute_frontend_tests(test_code, framework, target_url=target_url)
        else:
            results = test_executor.execute_backend_tests(test_code, framework, target_url=target_url)
        
        # Update requirement with results
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "testResults": results,
                    "status": "tests_executed",
                    "timestamps.testsExecuted": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "results": results,
            "jiraTicketId": request.jiraTicketId
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tests/review", response_model=TestReviewResponse)
async def review_tests(
    request: TestReviewRequest,
    review_agent: TestReviewerAgent = Depends(get_test_reviewer),
    db = Depends(get_database)
):
    """Review test results against Jira requirements + Spec + Scenarios."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        jira_data = requirement.get("jiraData", {})
        spec = requirement.get("spec", {})
        scenarios = requirement.get("testScenarios", [])
        test_results = requirement.get("testResults", {})
        
        if not test_results:
            raise HTTPException(status_code=400, detail="Tests must be executed first")
        
        # Review results with full context (Jira + Spec + Scenarios + Results)
        review = review_agent.review_test_results(jira_data, spec, scenarios, test_results)
        
        # Update requirement with review decision
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "reviewDecision": review,
                    "status": "reviewed",
                    "timestamps.reviewed": datetime.utcnow()
                }
            }
        )
        
        # Calculate counts
        passed_scenarios = review.get("passedScenarios", [])
        failed_scenarios = review.get("failedScenarios", [])
        passed_count = len(passed_scenarios)
        failed_count = len(failed_scenarios)
        total_count = passed_count + failed_count
        
        # Note: Jira comment is NOT posted here - it will be posted via /developer/feedback
        # This avoids duplicate comments
        
        return {
            "success": True,
            "passed": review.get("passed", False),
            "reasoning": review.get("reasoning", ""),
            "failedScenarios": failed_scenarios,
            "passedScenarios": passed_scenarios,
            "recommendations": review.get("recommendations", []),
            "passedCount": passed_count,
            "failedCount": failed_count,
            "totalCount": total_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Developer Feedback Route
@router.post("/developer/feedback", response_model=DeveloperFeedbackResponse)
async def generate_feedback(
    request: DeveloperFeedbackRequest,
    review_agent: TestReviewerAgent = Depends(get_test_reviewer),
    jira_service: JiraService = Depends(get_jira_service),
    db = Depends(get_database)
):
    """Generate feedback for failed tests and update Jira (raise issue to developer)."""
    try:
        requirements_collection = db["requirements"]
        requirement = await requirements_collection.find_one({"jiraTicketId": request.jiraTicketId})
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        review = requirement.get("reviewDecision", {})
        if not review:
            raise HTTPException(status_code=400, detail="Tests must be reviewed first")
        
        passed_scenarios = review.get("passedScenarios", [])
        failed_scenarios = review.get("failedScenarios", [])
        passed_count = len(passed_scenarios)
        failed_count = len(failed_scenarios)
        total_count = passed_count + failed_count
        pass_rate = round((passed_count / total_count) * 100) if total_count > 0 else 0
        is_passed = review.get("passed", False)
        
        # Generate detailed feedback
        feedback = {
            "summary": f"{failed_count} test scenario(s) failed" if failed_count > 0 else "All tests passed",
            "details": review.get("reasoning", ""),
            "passedScenarios": passed_scenarios,
            "failedScenarios": failed_scenarios,
            "recommendations": review.get("recommendations", []),
            "userMessage": request.message or ""
        }
        
        # Build ONE comprehensive Jira comment with all results
        status_text = "PASSED" if is_passed else "FAILED"
        comment = f"Test Execution Results - {status_text}\n\n"
        comment += f"Summary: {passed_count} passed, {failed_count} failed ({pass_rate}% pass rate)\n\n"
        
        # List passed tests
        if passed_scenarios:
            comment += "Passed Tests:\n"
            for scenario in passed_scenarios:
                name = scenario.get('name', scenario.get('title', 'N/A'))
                comment += f"- {scenario.get('scenarioId', 'N/A')}: {name}\n"
            comment += "\n"
        
        # List failed tests with details
        if failed_scenarios:
            comment += "Failed Tests:\n"
            for scenario in failed_scenarios:
                name = scenario.get('name', scenario.get('title', 'N/A'))
                error = scenario.get('error', 'Test failed')
                suggestion = scenario.get('suggestion', '')
                comment += f"- {scenario.get('scenarioId', 'N/A')}: {name}\n"
                comment += f"  Error: {error}\n"
                if suggestion:
                    comment += f"  Suggestion: {suggestion}\n"
            comment += "\n"
        
        # Add analysis if available
        if review.get("reasoning"):
            comment += f"Analysis:\n{review.get('reasoning')}\n\n"
        
        # Add QA notes if provided
        if request.message:
            comment += f"Additional Notes from QA:\n{request.message}\n\n"
        
        # Add recommendations
        if review.get("recommendations"):
            comment += "Recommendations:\n"
            for rec in review.get("recommendations", []):
                comment += f"- {rec}\n"
        
        if not is_passed:
            comment += "\nPlease fix the above issues and re-run the tests."
        
        # Add comment to Jira
        jira_service.add_comment(request.jiraTicketId, comment)
        
        # Assign to developer if email provided
        if request.developerEmail:
            try:
                jira_service.assign_ticket(request.jiraTicketId, request.developerEmail)
                feedback["assignedTo"] = request.developerEmail
            except Exception as e:
                feedback["assignmentError"] = str(e)
        
        # Update requirement
        await requirements_collection.update_one(
            {"jiraTicketId": request.jiraTicketId},
            {
                "$set": {
                    "feedback": feedback,
                    "status": "feedback_sent",
                    "timestamps.feedbackSent": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Feedback added to Jira ticket and developer notified",
            "feedback": feedback
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
