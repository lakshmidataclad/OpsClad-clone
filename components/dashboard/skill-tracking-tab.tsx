'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Search, Users, Star, Bot, Download, Eye, MessageSquare, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"

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

interface ProjectMatchHistory {
  id: string
  project_description: string
  matched_employees: ProjectMatch[]
  ai_reasoning: string
  created_at: string
}

const proficiencyLevels = [
  { value: 1, label: "Beginner", color: "bg-red-500" },
  { value: 2, label: "Novice", color: "bg-orange-500" },
  { value: 3, label: "Intermediate", color: "bg-yellow-500" },
  { value: 4, label: "Advanced", color: "bg-blue-600/40" },
  { value: 5, label: "Expert", color: "bg-green-600/40" }
]

export default function ManagerSkillTracker() {
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkillData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSkill, setFilterSkill] = useState("all")
  const [projectDescription, setProjectDescription] = useState("")
  const [aiResponse, setAiResponse] = useState<ProjectMatch[]>([])
  const [aiReasoning, setAiReasoning] = useState("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [matchHistory, setMatchHistory] = useState<ProjectMatchHistory[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)

  const { toast } = useToast()

  const skillNames = [...new Set(employeeSkills.map(skill => skill.skill_name))].sort()
  const employees = [...new Set(employeeSkills.map(skill => skill.employee_name))].sort()

  const loadEmployeeSkills = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all employees under this manager
      const { data, error } = await supabase
        .from('employee_skills_view')
        .select('*')
        .order('employee_name', { ascending: true })
        .order('skill_category', { ascending: true })
        .order('skill_name', { ascending: true })

      if (error) {
        console.error('Error loading employee skills:', error)
        toast({
          title: "Error Loading Data",
          description: "Failed to load employee skills. Please try again.",
          variant: "destructive",
        })
        return
      }

      setEmployeeSkills(data || [])
    } catch (error) {
      console.error('Error loading employee skills:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMatchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('project_matches')
        .select('*')
        .eq('manager_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading match history:', error)
        return
      }

      setMatchHistory(data || [])
    } catch (error) {
      console.error('Error loading match history:', error)
    }
  }

  const analyzeProjectWithAI = async () => {
    if (!projectDescription.trim()) {
      toast({
        title: "Project Description Required",
        description: "Please provide a project description to analyze.",
        variant: "destructive",
      })
      return
    }

    setLoadingAI(true)
    setAiResponse([])
    setAiReasoning("")

    try {
      // Simulate AI analysis - In a real app, you'd call an AI service like OpenAI
      const matches = await simulateAIProjectMatching(projectDescription, employeeSkills)
      
      setAiResponse(matches.candidates)
      setAiReasoning(matches.reasoning)

      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('project_matches')
          .insert([{
            manager_id: user.id,
            project_description: projectDescription,
            matched_employees: matches.candidates,
            ai_reasoning: matches.reasoning
          }])

        await loadMatchHistory()
      }

      toast({
        title: "Analysis Complete",
        description: `Found ${matches.candidates.length} potential candidates for your project.`,
      })

    } catch (error) {
      console.error('Error analyzing project:', error)
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAI(false)
    }
  }

  // Simulate AI project matching logic
  // Enhanced AI Project Matching Function
  const simulateAIProjectMatching = async (description: string, skills: EmployeeSkillData[]) => {
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API delay

    // Enhanced keyword extraction and processing
    const processDescription = (text: string) => {
      // Remove common stop words and clean the text
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'we', 'need', 'needs', 'requires', 'required', 'want', 'looking', 'build', 'create', 'develop', 'make', 'implement', 'project', 'application', 'system', 'solution', 'using']
      
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
      
      return [...new Set(words)] // Remove duplicates
    }

    // Comprehensive technology and skill synonyms mapping
    const synonymMap: Record<string, string[]> = {
      // Programming Languages
      'javascript': ['js', 'ecmascript', 'node.js', 'nodejs', 'typescript', 'ts', 'es6', 'es2015', 'vanilla-js'],
      'python': ['py', 'python3', 'python2', 'cpython', 'pypy'],
      'java': ['jvm', 'openjdk', 'oracle-java', 'java8', 'java11', 'java17'],
      'csharp': ['c#', '.net', 'dotnet', 'asp.net', 'blazor'],
      'cpp': ['c++', 'cplusplus', 'c++11', 'c++14', 'c++17', 'c++20'],
      'php': ['php7', 'php8', 'laravel', 'symphony', 'codeigniter'],
      'ruby': ['rb', 'ruby-on-rails', 'rails', 'ror', 'sinatra'],
      'go': ['golang', 'go-lang'],
      'rust': ['rust-lang', 'cargo'],
      'swift': ['ios-swift', 'swift5'],
      'kotlin': ['kt', 'android-kotlin'],
      'scala': ['scala-lang', 'akka'],
      'dart': ['flutter-dart', 'dart-lang'],
      'r': ['r-lang', 'r-programming', 'statistics'],
      'matlab': ['octave', 'mathematical-computing'],

      // Frontend Technologies
      'frontend': ['front-end', 'ui', 'user-interface', 'client-side', 'web-frontend'],
      'html': ['html5', 'markup', 'hypertext'],
      'css': ['css3', 'stylesheets', 'styling'],
      'sass': ['scss', 'css-preprocessor'],
      'less': ['lesscss', 'css-preprocessor'],
      'react': ['reactjs', 'react.js', 'jsx', 'tsx', 'react-hooks', 'react-native'],
      'vue': ['vuejs', 'vue.js', 'vue3', 'vue2', 'nuxt', 'nuxtjs'],
      'angular': ['angularjs', 'angular2', 'angular4', 'angular8', 'angular12', 'ng', 'ionic'],
      'svelte': ['sveltekit', 'svelte.js'],
      'jquery': ['jquery-ui', 'jquery-mobile'],
      'bootstrap': ['bootstrap4', 'bootstrap5', 'twitter-bootstrap'],
      'tailwind': ['tailwindcss', 'tailwind-css', 'utility-first'],
      'webpack': ['bundling', 'module-bundler', 'build-tools'],
      'vite': ['build-tool', 'dev-server'],
      'nextjs': ['next.js', 'next', 'vercel'],

      // Backend Technologies
      'backend': ['back-end', 'server-side', 'api', 'web-services'],
      'nodejs': ['node.js', 'node', 'npm', 'express', 'expressjs'],
      'django': ['python-web', 'django-rest'],
      'flask': ['python-flask', 'micro-framework'],
      'fastapi': ['python-api', 'async-python'],
      'spring': ['spring-boot', 'spring-framework', 'java-spring'],
      'rails': ['ruby-on-rails', 'ror', 'activerecord'],
      'laravel': ['php-framework', 'eloquent'],
      'aspnet': ['asp.net', '.net-core', 'c#-web'],
      'expressjs': ['express.js', 'express', 'node-express'],

      // Databases
      'database': ['db', 'databases', 'data-storage', 'persistence'],
      'sql': ['structured-query', 'relational-database'],
      'mysql': ['mariadb', 'percona'],
      'postgresql': ['postgres', 'psql', 'pg'],
      'sqlite': ['sqlite3', 'embedded-db'],
      'mongodb': ['mongo', 'nosql', 'document-db'],
      'redis': ['in-memory', 'caching', 'key-value'],
      'elasticsearch': ['elastic', 'search-engine', 'elk'],
      'cassandra': ['apache-cassandra', 'distributed-db'],
      'dynamodb': ['aws-dynamo', 'aws-nosql'],
      'oracle': ['oracle-db', 'plsql'],
      'mssql': ['sql-server', 'microsoft-sql', 't-sql'],

      // Cloud & DevOps
      'cloud': ['cloud-computing', 'saas', 'paas', 'iaas'],
      'aws': ['amazon-web-services', 'ec2', 's3', 'lambda', 'rds', 'cloudformation'],
      'azure': ['microsoft-azure', 'azure-functions', 'azure-devops'],
      'gcp': ['google-cloud', 'google-cloud-platform', 'gke'],
      'docker': ['containerization', 'containers', 'dockerfile'],
      'kubernetes': ['k8s', 'container-orchestration', 'helm'],
      'terraform': ['infrastructure-as-code', 'iac'],
      'ansible': ['automation', 'configuration-management'],
      'jenkins': ['ci-cd', 'continuous-integration', 'build-automation'],
      'github-actions': ['gh-actions', 'github-ci'],
      'gitlab': ['gitlab-ci', 'git-ops'],
      'serverless': ['faas', 'lambda', 'functions'],

      // Mobile Development
      'mobile': ['mobile-app', 'smartphone', 'tablet'],
      'ios': ['iphone', 'ipad', 'apple', 'app-store'],
      'android': ['google-play', 'mobile-android'],
      'react-native': ['rn', 'cross-platform-mobile'],
      'flutter': ['cross-platform', 'dart-mobile'],
      'xamarin': ['microsoft-mobile', 'cross-platform'],
      'cordova': ['phonegap', 'hybrid-mobile'],

      // Testing
      'testing': ['qa', 'quality-assurance', 'test-automation'],
      'unit-testing': ['unit-tests', 'tdd', 'test-driven'],
      'integration-testing': ['integration-tests', 'api-testing'],
      'selenium': ['web-automation', 'browser-testing'],
      'cypress': ['e2e-testing', 'end-to-end'],
      'jest': ['javascript-testing', 'unit-testing'],
      'pytest': ['python-testing', 'test-framework'],
      'junit': ['java-testing', 'unit-tests'],

      // Data & Analytics
      'data': ['data-analysis', 'big-data', 'data-science'],
      'analytics': ['data-analytics', 'business-intelligence', 'reporting'],
      'visualization': ['data-viz', 'charts', 'graphs', 'dashboards'],
      'tableau': ['bi-tools', 'data-visualization'],
      'powerbi': ['power-bi', 'microsoft-bi'],
      'pandas': ['python-data', 'dataframes'],
      'numpy': ['numerical-python', 'scientific-computing'],
      'matplotlib': ['python-plotting', 'data-visualization'],
      'spark': ['apache-spark', 'big-data-processing'],
      'hadoop': ['big-data', 'distributed-computing'],
      'etl': ['data-pipeline', 'extract-transform-load'],

      // AI & Machine Learning
      'ai': ['artificial-intelligence', 'machine-learning', 'deep-learning'],
      'machine-learning': ['ml', 'predictive-modeling', 'algorithms'],
      'deep-learning': ['neural-networks', 'tensorflow', 'pytorch'],
      'tensorflow': ['tf', 'keras', 'google-ml'],
      'pytorch': ['torch', 'facebook-ml'],
      'scikit-learn': ['sklearn', 'python-ml'],
      'opencv': ['computer-vision', 'image-processing'],
      'nlp': ['natural-language', 'text-processing', 'linguistics'],

      // Security
      'security': ['cybersecurity', 'infosec', 'application-security'],
      'authentication': ['auth', 'login', 'oauth', 'jwt', 'saml'],
      'authorization': ['permissions', 'access-control', 'rbac'],
      'encryption': ['cryptography', 'ssl', 'tls', 'https'],
      'penetration-testing': ['pentesting', 'ethical-hacking', 'vulnerability'],

      // Design & UX
      'design': ['ui-design', 'visual-design', 'graphic-design'],
      'ux': ['user-experience', 'usability', 'user-research'],
      'ui': ['user-interface', 'interface-design'],
      'figma': ['design-tools', 'prototyping'],
      'sketch': ['ui-design', 'vector-design'],
      'photoshop': ['image-editing', 'adobe-ps'],
      'illustrator': ['vector-graphics', 'adobe-ai'],
      'wireframing': ['mockups', 'prototypes', 'user-flows'],

      // Project Management & Methodologies
      'agile': ['scrum', 'kanban', 'sprint', 'user-stories'],
      'scrum': ['agile-methodology', 'sprint-planning', 'daily-standup'],
      'kanban': ['lean', 'workflow-management'],
      'project-management': ['pm', 'planning', 'coordination'],
      'leadership': ['team-lead', 'management', 'mentoring'],
      'communication': ['collaboration', 'teamwork', 'presentations'],

      // API & Integration
      'api': ['rest', 'restful', 'web-services', 'microservices'],
      'rest': ['restful-api', 'http-api', 'json-api'],
      'graphql': ['query-language', 'apollo', 'relay'],
      'soap': ['web-services', 'xml-api'],
      'microservices': ['service-oriented', 'distributed-architecture'],
      'webhooks': ['event-driven', 'callbacks'],

      // Version Control & Collaboration
      'git': ['version-control', 'source-control', 'github', 'gitlab', 'bitbucket'],
      'github': ['git-hosting', 'code-collaboration'],
      'gitlab': ['devops-platform', 'ci-cd'],
      'svn': ['subversion', 'centralized-vcs'],

      // Business & Domain
      'ecommerce': ['e-commerce', 'online-store', 'shopping-cart', 'payments'],
      'fintech': ['financial-technology', 'payments', 'banking'],
      'healthcare': ['medical', 'hipaa', 'patient-data'],
      'education': ['edtech', 'learning-management', 'e-learning'],
      'crm': ['customer-relationship', 'sales-management'],
      'erp': ['enterprise-resource', 'business-processes'],
    }

    // Extract and expand keywords using synonyms
    const expandKeywords = (words: string[]) => {
      const expanded = new Set(words)
      
      words.forEach(word => {
        // Add exact matches from synonym map
        Object.entries(synonymMap).forEach(([key, synonyms]) => {
          if (synonyms.includes(word) || key === word) {
            expanded.add(key)
            synonyms.forEach(synonym => expanded.add(synonym))
          }
        })
        
        // Add partial matches for compound words
        Object.keys(synonymMap).forEach(key => {
          if (word.includes(key) || key.includes(word)) {
            expanded.add(key)
          }
        })
      })
      
      return Array.from(expanded)
    }

    const descriptionKeywords = processDescription(description)
    const expandedKeywords = expandKeywords(descriptionKeywords)
    
    // Advanced scoring system
    const employeeScores = new Map<string, { 
      score: number, 
      matchingSkills: any[], 
      employee: EmployeeSkillData,
      matchDetails: {
        exactMatches: number,
        partialMatches: number,
        synonymMatches: number,
        categoryMatches: number,
        avgProficiency: number,
        totalExperience: number,
        recentUsage: number,
        skillCount: number
      }
    }>()

    skills.forEach(skill => {
      const skillWords = skill.skill_name.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
      const categoryWords = skill.skill_category.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
      const skillText = skill.skill_name.toLowerCase()
      const categoryText = skill.skill_category.toLowerCase()
      
      let matchScore = 0
      let exactMatches = 0
      let partialMatches = 0
      let synonymMatches = 0
      let categoryMatches = 0

      // 1. Exact keyword matching (highest weight)
      expandedKeywords.forEach(keyword => {
        if (skillText === keyword) {
          matchScore += 15
          exactMatches++
        } else if (skillText.includes(keyword)) {
          matchScore += 10
          partialMatches++
        } else if (skillWords.some(word => word === keyword)) {
          matchScore += 8
          partialMatches++
        }
      })

      // 2. Partial word matching
      expandedKeywords.forEach(keyword => {
        skillWords.forEach(word => {
          if (word.includes(keyword) && word !== keyword) {
            matchScore += 5
            partialMatches++
          }
        })
      })

      // 3. Category matching
      expandedKeywords.forEach(keyword => {
        if (categoryText.includes(keyword)) {
          matchScore += 4
          categoryMatches++
        } else if (categoryWords.some(word => word.includes(keyword))) {
          matchScore += 3
          categoryMatches++
        }
      })

      // 4. Synonym and related technology matching
      expandedKeywords.forEach(keyword => {
        Object.entries(synonymMap).forEach(([key, synonyms]) => {
          if ((key === keyword || synonyms.includes(keyword)) && 
              (skillText.includes(key) || synonyms.some(syn => skillText.includes(syn)))) {
            matchScore += 6
            synonymMatches++
          }
        })
      })

      // 5. Apply proficiency multiplier (1.0 to 2.0)
      const proficiencyMultiplier = 1 + (skill.proficiency_level - 1) * 0.25

      // 6. Experience bonus
      const experienceBonus = Math.min(skill.years_experience * 0.8, 8)

      // 7. Recent usage bonus
      let recentUsageBonus = 0
      if (skill.last_used) {
        const lastUsedDate = new Date(skill.last_used)
        const monthsAgo = (new Date().getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        recentUsageBonus = monthsAgo < 6 ? 4 : monthsAgo < 12 ? 3 : monthsAgo < 24 ? 2 : 1
      }

      // Calculate final score
      const baseScore = matchScore
      const finalScore = (baseScore * proficiencyMultiplier) + experienceBonus + recentUsageBonus

      if (finalScore > 0) {
        const employeeKey = skill.employee_id
        if (!employeeScores.has(employeeKey)) {
          employeeScores.set(employeeKey, {
            score: 0,
            matchingSkills: [],
            employee: skill,
            matchDetails: {
              exactMatches: 0,
              partialMatches: 0,
              synonymMatches: 0,
              categoryMatches: 0,
              avgProficiency: 0,
              totalExperience: 0,
              recentUsage: 0,
              skillCount: 0
            }
          })
        }

        const current = employeeScores.get(employeeKey)!
        current.score += finalScore
        current.matchDetails.exactMatches += exactMatches
        current.matchDetails.partialMatches += partialMatches
        current.matchDetails.synonymMatches += synonymMatches
        current.matchDetails.categoryMatches += categoryMatches
        current.matchDetails.totalExperience += skill.years_experience
        current.matchDetails.recentUsage += recentUsageBonus

        // Avoid duplicate skills for the same employee
        if (!current.matchingSkills.some(ms => ms.skill === skill.skill_name)) {
          current.matchDetails.skillCount++
          current.matchingSkills.push({
            skill: skill.skill_name,
            proficiency: skill.proficiency_level,
            category: skill.skill_category,
            experience: skill.years_experience,
            lastUsed: skill.last_used,
            matchReason: exactMatches > 0 ? 'Exact match' : 
                         partialMatches > 0 ? 'Partial match' : 
                         synonymMatches > 0 ? 'Related technology' : 
                         'Category match'
          })
        }
      }
    })

    // Calculate average proficiency
    employeeScores.forEach((employee, key) => {
      if (employee.matchingSkills.length > 0) {
        employee.matchDetails.avgProficiency = 
          employee.matchingSkills.reduce((sum, skill) => sum + skill.proficiency, 0) / employee.matchingSkills.length
      }
    })

    const sortedCandidates = Array.from(employeeScores.values())
      .filter(candidate => candidate.matchingSkills.length > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.matchDetails.avgProficiency !== a.matchDetails.avgProficiency) 
          return b.matchDetails.avgProficiency - a.matchDetails.avgProficiency
        return b.matchDetails.totalExperience - a.matchDetails.totalExperience
      })
      .slice(0, 8)
      .map((candidate, index) => {
        const details = candidate.matchDetails
        const reasoningParts = []
        
        if (details.exactMatches > 0) {
          reasoningParts.push(`${details.exactMatches} exact skill match${details.exactMatches > 1 ? 'es' : ''}`)
        }
        if (details.partialMatches > 0) {
          reasoningParts.push(`${details.partialMatches} partial match${details.partialMatches > 1 ? 'es' : ''}`)
        }
        if (details.synonymMatches > 0) {
          reasoningParts.push(`${details.synonymMatches} related technolog${details.synonymMatches > 1 ? 'ies' : 'y'}`)
        }

        const avgProf = Math.round(details.avgProficiency * 10) / 10
        const totalExp = details.totalExperience
        
        let reasoning = `Strong candidate with ${reasoningParts.join(', ')}. `
        reasoning += `Average proficiency: ${avgProf}/5.0`
        if (totalExp > 0) {
          reasoning += `, ${totalExp} years total experience`
        }
        if (details.recentUsage > 0) {
          reasoning += `, recently active in relevant technologies`
        }

        return {
          employee_name: candidate.employee.employee_name,
          employee_id: candidate.employee.employee_id,
          department: candidate.employee.department,
          position: candidate.employee.position,
          rawScore: candidate.score,
          matching_skills: candidate.matchingSkills.sort((a, b) => b.proficiency - a.proficiency),
          reasoning: reasoning,
          matchDetails: details
        }
      })

    // Calculate actual match percentages based on skill relevance
    sortedCandidates.forEach((candidate) => {
      const details = candidate.matchDetails
      let matchPercentage = 0
      
      // Base score from match types
      if (details.exactMatches > 0) {
        // Exact matches: 75-95% base depending on number of matches
        matchPercentage = Math.min(75 + (details.exactMatches * 8), 95)
      } else if (details.partialMatches > 0) {
        // Partial matches: 50-80% base
        matchPercentage = Math.min(50 + (details.partialMatches * 6), 80)
      } else if (details.synonymMatches > 0) {
        // Synonym matches: 40-70% base
        matchPercentage = Math.min(40 + (details.synonymMatches * 5), 70)
      } else {
        // Category matches only: 20-50% base
        matchPercentage = Math.min(20 + (details.categoryMatches * 3), 50)
      }
      
      // Proficiency boost: up to +15%
      const proficiencyBoost = Math.round((details.avgProficiency - 1) * 3.75)
      matchPercentage += proficiencyBoost
      
      // Experience boost: up to +5%
      const expYears = Math.min(details.totalExperience, 10)
      const expBoost = Math.round(expYears * 0.5)
      matchPercentage += expBoost
      
      // Recent usage boost: up to +3%
      if (details.recentUsage > 0) {
        matchPercentage += Math.min(Math.round(details.recentUsage * 0.75), 3)
      }
      
      // Multiple matching skills bonus: up to +5%
      if (details.skillCount > 1) {
        matchPercentage += Math.min(details.skillCount - 1, 5)
      }
      
      // Cap at 100%
      candidate.match_score = Math.min(matchPercentage, 100)
      delete candidate.rawScore
    })

    // Generate comprehensive analysis summary
    const uniqueSkillsAnalyzed = new Set(skills.map(s => s.skill_name)).size
    const uniqueEmployees = new Set(skills.map(s => s.employee_name)).size
    const keywordCount = expandedKeywords.length
    const originalKeywords = descriptionKeywords.length
    
    const analysisReasoning = `Analyzed project requirements containing ${originalKeywords} key terms, expanded to ${keywordCount} related keywords using comprehensive technology synonym mapping. ` +
      `Evaluated ${uniqueSkillsAnalyzed} distinct skills across ${uniqueEmployees} employees. ` +
      `Advanced scoring considers exact matches (15pts), partial matches (5-10pts), related technologies (6pts), and category alignment (3-4pts), ` +
      `weighted by proficiency levels (1.0-2.0x), experience bonuses, and recent usage. ` +
      `Found ${sortedCandidates.length} qualified candidates with measurable skill alignment.`

    return {
      candidates: sortedCandidates,
      reasoning: analysisReasoning
    }
  }

  const getFilteredSkills = () => {
    return employeeSkills.filter(skill => {
      const matchesSearch = 
        skill.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.skill_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.skill_category.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSkill = filterSkill === "all" || skill.skill_name === filterSkill
      const matchesEmployee = !selectedEmployee || skill.employee_name === selectedEmployee

      return matchesSearch && matchesSkill && matchesEmployee
    })
  }

  const renderStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < level ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ))
  }

  const getProficiencyInfo = (level: number) => {
    return proficiencyLevels.find(p => p.value === level) || proficiencyLevels[0]
  }

  const exportToCSV = () => {
    const filteredSkills = getFilteredSkills()
    const headers = ['Employee Name', 'Employee ID', 'Skill', 'Category', 'Proficiency Level', 'Years Experience']
    
    const csvContent = [
      headers.join(','),
      ...filteredSkills.map(skill => [
        `"${skill.employee_name}"`,
        skill.emp_id,
        `"${skill.skill_name}"`,
        `"${skill.skill_category}"`,
        skill.proficiency_level,
        skill.years_experience
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Employee_Skills_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  useEffect(() => {
    Promise.all([loadEmployeeSkills(), loadMatchHistory()])
  }, [])

  const filteredSkills = getFilteredSkills()

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-gray-800 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <div>
          <CardTitle className="text-white">Employee Skill Management</CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            View team skills and match employees to projects with AI
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Skills CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="team-skills" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800">
          <TabsTrigger value="team-skills" className="text-gray-200 data-[state=active]:bg-gray-950">Team Skills</TabsTrigger>
          <TabsTrigger value="ai-matching" className="text-gray-200 data-[state=active]:bg-gray-950">AI Project Matching</TabsTrigger>
        </TabsList>

        <TabsContent value="team-skills" className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search" className="text-white">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search employees, skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-950 text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="skill-filter" className="text-white">Skill</Label>
              <Select value={filterSkill} onValueChange={setFilterSkill}>
                <SelectTrigger className="bg-gray-950 text-white">
                  <SelectValue placeholder="All skills" />
                </SelectTrigger>
                <SelectContent className="bg-gray-950">
                  <SelectItem value="all">All skills</SelectItem>
                  {skillNames.map(skill => (
                    <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="employee-filter" className="text-white">Employee</Label>
              <Select value={selectedEmployee || "all"} onValueChange={(value) => setSelectedEmployee(value === "all" ? null : value)}>
                <SelectTrigger className="bg-gray-950 text-white">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent className="bg-gray-950">
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Skills Table */}
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-black">Skills Overview</CardTitle>
                  <CardDescription className="text-gray-400">
                    Showing {filteredSkills.length} skills across your team
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-500 text-blue-600">
                  <Users className="w-4 h-4 mr-1" />
                  {employees.length} Employees
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-96 border border-gray-300 rounded-lg">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="border-gray-700 bg-gray-200">
                      <TableHead className="text-black">ID</TableHead>
                      <TableHead className="text-black">Employee</TableHead>
                      <TableHead className="text-black">Skill</TableHead>
                      <TableHead className="text-black">Category</TableHead>
                      <TableHead className="text-black">Proficiency</TableHead>
                      <TableHead className="text-black">Experience</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSkills.map((skill, index) => {
                      const proficiencyInfo = getProficiencyInfo(skill.proficiency_level)
                      return (
                        <TableRow key={`${skill.employee_id}-${skill.skill_name}-${index}`} className="border-gray-700">
                          <TableCell className="text-black">
                            <div>
                              <p className="text-black">{skill.emp_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-black">
                            <div>
                              <p className="text-black">{skill.employee_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-black">
                            <div>
                              <p className="text-black">{skill.skill_name}</p>
                              {skill.notes && (
                                <p className="text-xs text-gray-600 italic mt-1">"{skill.notes}"</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-black">
                            <Badge variant="outline" className="border-gray-400 text-gray-600">
                              {skill.skill_category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-black">
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {renderStars(skill.proficiency_level)}
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full text-white ${proficiencyInfo.color}`}>
                                {proficiencyInfo.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-black">
                            {skill.years_experience > 0 ? (
                              <Badge variant="outline" className="border-orange-500 text-orange-500">
                                {skill.years_experience}y
                              </Badge>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {filteredSkills.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No skills found matching your filters.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-matching" className="space-y-6">
          {/* Project Description Input */}
          <Card className="bg-white border-gray-700">
            <CardHeader>
              <CardTitle className="text-black flex items-center gap-2">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Project Matching
              </CardTitle>
              <CardDescription className="text-gray-400">
                Describe your project requirements and get AI-powered employee recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project-description" className="text-black">Project Description</Label>
                <Textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe your project requirements, needed skills, technologies, etc. For example: 'We need to build a React web application with Node.js backend, PostgreSQL database, and requires strong JavaScript skills, API development experience, and UI/UX design capabilities.'"
                  className="bg-gray-50 text-black min-h-[120px]"
                  rows={6}
                />
              </div>
              <div className="flex justify-between items-center">
                <Button
                  onClick={analyzeProjectWithAI}
                  disabled={loadingAI || !projectDescription.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loadingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Find Best Candidates
                    </>
                  )}
                </Button>
                <p className="text-sm text-gray-600">
                  {projectDescription.length}/1000 characters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Results */}
          {(aiResponse.length > 0 || loadingAI) && (
            <Card className="bg-white border-gray-700">
              <CardHeader>
                <CardTitle className="text-black">Recommended Candidates</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAI ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                      <p className="text-gray-600">Analyzing project requirements and matching with team skills...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiResponse.map((match, index) => (
                        <Card key={match.employee_id} className="bg-gray-100 border-gray-100">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-sm font-medium text-black">
                                  {match.employee_name}
                                </CardTitle>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-blue-900">
                                  {match.match_score}%
                                </div>
                                <div className="text-xs text-gray-500">Match Score</div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 -mt-8">
                            <div className="space-y-3">
                              <div>
                                <h5 className="text-xs font-medium text-gray-700 mb-2">Matching Skills:</h5>
                                <div className="flex flex-wrap gap-1">
                                  {match.matching_skills.slice(0, 4).map((skill, skillIndex) => (
                                    <Badge
                                      key={skillIndex}
                                      variant="outline"
                                      className="text-xs border-orange-500 text-orange-500"
                                    >
                                      {skill.skill} ({skill.proficiency}/5)
                                    </Badge>
                                  ))}
                                  {match.matching_skills.length > 4 && (
                                    <Badge variant="outline" className="text-xs border-gray-400 text-gray-600">
                                      +{match.matching_skills.length - 4} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600">
                                <p className="italic">"{match.reasoning}"</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}