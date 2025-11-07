// app/api/ai-project-matching/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface EmployeeSkillData {
  employee_id: string
  employee_name: string
  emp_id: string
  department: string
  position: string
  skill_name: string
  skill_category: string
  skill_description: string
  proficiency_level: number
  years_experience: number
  notes: string
  last_used: string
}

interface ProjectMatch {
  employee_name: string
  employee_id: string
  department: string
  position: string
  match_score: number
  matching_skills: {
    skill: string
    proficiency: number
    category: string
  }[]
  reasoning: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { projectDescription } = await request.json()

    if (!projectDescription || typeof projectDescription !== 'string') {
      return NextResponse.json(
        { error: 'Project description is required' },
        { status: 400 }
      )
    }

    // Get all employee skills from the database
    const { data: employeeSkills, error: skillsError } = await supabase
      .from('employee_skills_view')
      .select('*')

    if (skillsError) {
      console.error('Error fetching skills:', skillsError)
      return NextResponse.json(
        { error: 'Failed to fetch employee skills' },
        { status: 500 }
      )
    }

    // Process the project description and match with employees
    const matches = await analyzeProjectRequirements(projectDescription, employeeSkills || [])

    // Save the match result to the database
    const { error: saveError } = await supabase
      .from('project_matches')
      .insert([{
        manager_id: user.id,
        project_description: projectDescription,
        matched_employees: matches.candidates,
        ai_reasoning: matches.reasoning
      }])

    if (saveError) {
      console.error('Error saving match results:', saveError)
      // Don't return error here, just log it - the main functionality worked
    }

    return NextResponse.json({
      success: true,
      candidates: matches.candidates,
      reasoning: matches.reasoning,
      total_employees_analyzed: employeeSkills?.length || 0
    })

  } catch (error) {
    console.error('Error in AI project matching:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function analyzeProjectRequirements(
  description: string, 
  skills: EmployeeSkillData[]
): Promise<{ candidates: ProjectMatch[], reasoning: string }> {
  
  // Enhanced keyword extraction with technology-specific terms
  const techKeywords = {
    'frontend': ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'ui', 'ux', 'frontend', 'web'],
    'backend': ['node.js', 'python', 'java', 'c#', 'php', 'backend', 'server', 'api', 'rest', 'graphql'],
    'database': ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'database', 'db', 'data'],
    'mobile': ['react native', 'flutter', 'ios', 'android', 'mobile', 'app'],
    'devops': ['docker', 'kubernetes', 'aws', 'azure', 'ci/cd', 'deployment', 'cloud'],
    'design': ['figma', 'photoshop', 'ui/ux', 'design', 'wireframe', 'prototype'],
    'management': ['agile', 'scrum', 'project management', 'leadership', 'team lead']
  }

  const descriptionLower = description.toLowerCase()
  const keywords = descriptionLower.split(/\s+/)
  
  // Identify project categories and requirements
  const projectCategories = new Set<string>()
  const requiredSkills = new Set<string>()

  Object.entries(techKeywords).forEach(([category, terms]) => {
    if (terms.some(term => descriptionLower.includes(term))) {
      projectCategories.add(category)
      terms.forEach(term => {
        if (descriptionLower.includes(term)) {
          requiredSkills.add(term)
        }
      })
    }
  })

  // Score employees based on skill matches
  const employeeScores = new Map<string, {
    score: number
    matchingSkills: any[]
    employee: EmployeeSkillData
    categoryMatches: Set<string>
  }>()

  skills.forEach(skill => {
    const skillName = skill.skill_name.toLowerCase()
    const skillCategory = skill.skill_category.toLowerCase()
    const employeeKey = skill.employee_id

    if (!employeeScores.has(employeeKey)) {
      employeeScores.set(employeeKey, {
        score: 0,
        matchingSkills: [],
        employee: skill,
        categoryMatches: new Set()
      })
    }

    const employeeData = employeeScores.get(employeeKey)!
    let skillScore = 0

    // Direct skill name matches (highest weight)
    requiredSkills.forEach(requiredSkill => {
      if (skillName.includes(requiredSkill) || requiredSkill.includes(skillName.split(' ')[0])) {
        skillScore += 5 * skill.proficiency_level
      }
    })

    // Keyword matches in skill name
    keywords.forEach(keyword => {
      if (keyword.length > 2 && skillName.includes(keyword)) {
        skillScore += 2 * skill.proficiency_level
      }
    })

    // Category matches
    projectCategories.forEach(category => {
      if (skillCategory.includes(category) || 
          (category === 'frontend' && skillCategory.includes('technical')) ||
          (category === 'backend' && skillCategory.includes('technical')) ||
          (category === 'design' && skillCategory.includes('design'))) {
        skillScore += 1.5 * skill.proficiency_level
        employeeData.categoryMatches.add(category)
      }
    })

    // Boost for recent experience
    if (skill.last_used) {
      const lastUsedDate = new Date(skill.last_used)
      const monthsAgo = (Date.now() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsAgo < 12) {
        skillScore *= 1.2 // 20% boost for skills used in last year
      }
    }

    // Boost for extensive experience
    if (skill.years_experience > 3) {
      skillScore *= (1 + Math.min(skill.years_experience / 10, 0.5)) // Up to 50% boost
    }

    if (skillScore > 0) {
      employeeData.score += skillScore
      employeeData.matchingSkills.push({
        skill: skill.skill_name,
        proficiency: skill.proficiency_level,
        category: skill.skill_category,
        score: skillScore
      })
    }
  })

  // Calculate final scores and create candidate list
  const candidates: ProjectMatch[] = Array.from(employeeScores.values())
    .filter(emp => emp.score > 0)
    .map(emp => {
      // Normalize score to percentage (0-100)
      const maxPossibleScore = emp.matchingSkills.length * 5 * 5 // max skills * max proficiency * max weight
      const normalizedScore = Math.min((emp.score / Math.max(maxPossibleScore * 0.3, 10)) * 100, 100)
      
      // Sort matching skills by score
      const topSkills = emp.matchingSkills
        .sort((a, b) => b.score - a.score)
        .slice(0, 8) // Top 8 matching skills

      const avgProficiency = topSkills.reduce((sum, skill) => sum + skill.proficiency, 0) / topSkills.length

      return {
        employee_name: emp.employee.employee_name,
        employee_id: emp.employee.employee_id,
        department: emp.employee.department,
        position: emp.employee.position,
        match_score: Math.round(normalizedScore * 10) / 10,
        matching_skills: topSkills.map(skill => ({
          skill: skill.skill,
          proficiency: skill.proficiency,
          category: skill.category
        })),
        reasoning: generateEmployeeReasoning(emp, avgProficiency, projectCategories)
      }
    })
    .sort((a, b) => b.match_score - a.score)
    .slice(0, 8) // Top 8 candidates

  const reasoning = generateAnalysisReasoning(description, candidates, projectCategories, skills.length)

  return {
    candidates,
    reasoning
  }
}

function generateEmployeeReasoning(
  emp: { matchingSkills: any[], categoryMatches: Set<string> },
  avgProficiency: number,
  projectCategories: Set<string>
): string {
  const skillCount = emp.matchingSkills.length
  const categoryMatches = emp.categoryMatches.size
  const totalCategories = projectCategories.size

  let reasoning = `Strong candidate with ${skillCount} relevant skills`
  
  if (avgProficiency >= 4) {
    reasoning += ` and expert-level proficiency (${avgProficiency.toFixed(1)}/5.0)`
  } else if (avgProficiency >= 3) {
    reasoning += ` and solid proficiency (${avgProficiency.toFixed(1)}/5.0)`
  }

  if (categoryMatches > 0 && totalCategories > 0) {
    const coveragePercent = Math.round((categoryMatches / totalCategories) * 100)
    reasoning += `. Covers ${coveragePercent}% of required project areas`
  }

  return reasoning + '.'
}

function generateAnalysisReasoning(
  description: string,
  candidates: ProjectMatch[],
  projectCategories: Set<string>,
  totalSkills: number
): string {
  const categories = Array.from(projectCategories)
  const topCandidate = candidates[0]
  
  let reasoning = `Analyzed ${totalSkills} employee skills against project requirements. `
  
  if (categories.length > 0) {
    reasoning += `Identified key areas: ${categories.join(', ')}. `
  }
  
  reasoning += `Found ${candidates.length} qualified candidates. `
  
  if (topCandidate && topCandidate.match_score > 80) {
    reasoning += `Top candidate (${topCandidate.employee_name}) shows exceptional match with ${topCandidate.match_score}% compatibility.`
  } else if (topCandidate && topCandidate.match_score > 60) {
    reasoning += `Top candidate (${topCandidate.employee_name}) shows strong potential with ${topCandidate.match_score}% compatibility.`
  } else {
    reasoning += `Candidates show varying levels of compatibility, with consideration needed for specific project requirements.`
  }
  
  return reasoning
}