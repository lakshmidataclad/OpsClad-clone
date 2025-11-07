'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, Star, Trash2, Calendar, Loader2, User, Building, Briefcase } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface EmployeeSkill {
  id: string
  skill_name: string
  skill_category: string
  skill_description: string
  proficiency_level: number
  years_experience: number
  notes: string
  last_used: string
  updated_at: string
}

interface UserProfile {
  id: string
  username: string
  email: string
  employee_id: string
  full_name?: string
}

const proficiencyLevels = [
  { value: 1, label: "Beginner", description: "Basic understanding", color: "bg-red-500" },
  { value: 2, label: "Novice", description: "Limited experience", color: "bg-orange-500" },
  { value: 3, label: "Intermediate", description: "Practical application", color: "bg-yellow-500" },
  { value: 4, label: "Advanced", description: "Highly skilled", color: "bg-blue-600/40" },
  { value: 5, label: "Expert", description: "Comprehensive mastery", color: "bg-green-600/40" }
]

export default function EmployeeSkillTracker() {
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkill[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false)
  const [skillFormData, setSkillFormData] = useState({
    skill_name: "",
    skill_category: "",
    skill_description: "",
    proficiency_level: 1,
    years_experience: 0,
    notes: "",
    last_used: ""
  })
  const [processingSkills, setProcessingSkills] = useState(new Set<string>())

  const { toast } = useToast()

  const filteredSkills = employeeSkills.filter(skill => 
    skill.skill_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.skill_category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        return
      }

      if (profileData) {
        // Try to get additional employee data
        const { data: employeeData } = await supabase
          .from('employees')
          .select('name')
          .eq('email_id', profileData.email)
          .single()

        setUserProfile({
          ...profileData,
          full_name: employeeData?.name
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const loadEmployeeSkills = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('employee_skills_detailed_view')
        .select('*')
        .eq('employee_id', user.id)
        .order('skill_category', { ascending: true })
        .order('skill_name', { ascending: true })

      if (error) {
        console.error('Error loading employee skills:', error)
        return
      }

      setEmployeeSkills(data || [])
    } catch (error) {
      console.error('Error loading employee skills:', error)
    }
  }

  const addSkillToEmployee = async () => {
    if (!skillFormData.skill_name.trim() || !skillFormData.skill_category.trim()) {
      toast({
        title: "Incomplete Information",
        description: "Please provide skill name and category.",
        variant: "destructive",
      })
      return
    }

    setProcessingSkills(prev => new Set(prev).add('new-skill'))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // First, create or get the skill
      let skillId
      const { data: existingSkill } = await supabase
        .from('skills')
        .select('id')
        .eq('name', skillFormData.skill_name)
        .single()

      if (existingSkill) {
        skillId = existingSkill.id
      } else {
        // Create new skill
        const { data: newSkill, error: skillError } = await supabase
          .from('skills')
          .insert([{
            name: skillFormData.skill_name,
            category: skillFormData.skill_category,
            description: skillFormData.skill_description || null,
            created_by: user.id
          }])
          .select('id')
          .single()

        if (skillError) {
          console.error('Error creating skill:', skillError)
          toast({
            title: "Failed to Add Skill",
            description: skillError.message || "Failed to create skill. Please try again.",
            variant: "destructive",
          })
          return
        }
        skillId = newSkill.id
      }

      // Now add the skill to employee
      const employeeSkillData = {
        employee_id: user.id,
        skill_id: skillId,
        proficiency_level: skillFormData.proficiency_level,
        years_experience: skillFormData.years_experience,
        notes: skillFormData.notes || null,
        last_used: skillFormData.last_used || null
      }

      const { error } = await supabase
        .from('employee_skills')
        .insert([employeeSkillData])

      if (error) {
        console.error('Error adding skill:', error)
        toast({
          title: "Failed to Add Skill",
          description: error.message || "Failed to add skill. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Skill Added",
        description: `${skillFormData.skill_name} has been added to your skills.`,
      })

      await loadEmployeeSkills()
      setIsAddSkillOpen(false)
      setSkillFormData({
        skill_name: "",
        skill_category: "",
        skill_description: "",
        proficiency_level: 1,
        years_experience: 0,
        notes: "",
        last_used: ""
      })
    } catch (error) {
      console.error('Error adding skill:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the skill.",
        variant: "destructive",
      })
    } finally {
      setProcessingSkills(prev => {
        const newSet = new Set(prev)
        newSet.delete('new-skill')
        return newSet
      })
    }
  }

  const removeEmployeeSkill = async (skillId: string) => {
    setProcessingSkills(prev => new Set(prev).add(skillId))

    try {
      const { error } = await supabase
        .from('employee_skills')
        .delete()
        .eq('id', skillId)

      if (error) {
        console.error('Error removing skill:', error)
        toast({
          title: "Removal Failed",
          description: "Failed to remove skill. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Skill Removed",
        description: "The skill has been removed from your profile.",
      })

      await loadEmployeeSkills()
    } catch (error) {
      console.error('Error removing skill:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while removing the skill.",
        variant: "destructive",
      })
    } finally {
      setProcessingSkills(prev => {
        const newSet = new Set(prev)
        newSet.delete(skillId)
        return newSet
      })
    }
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

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      await Promise.all([loadUserProfile(), loadEmployeeSkills()])
      setLoading(false)
    }

    initializeData()
  }, [])

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
          <CardTitle className="text-white">Skills Management</CardTitle>
        </div>
        <div className="flex items-center gap-4">
          <Dialog open={isAddSkillOpen} onOpenChange={setIsAddSkillOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Skill
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Skill</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Add a skill to your professional profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="skill-name" className="text-white">Skill Name*</Label>
                    <Input
                      id="skill-name"
                      value={skillFormData.skill_name}
                      onChange={(e) => setSkillFormData(prev => ({ ...prev, skill_name: e.target.value }))}
                      className="bg-gray-950 text-white"
                      placeholder="e.g., JavaScript, Project Management"
                    />
                  </div>
                  <div>
                    <Label htmlFor="skill-category" className="text-white">Category*</Label>
                    <Input
                      id="skill-category"
                      value={skillFormData.skill_category}
                      onChange={(e) => setSkillFormData(prev => ({ ...prev, skill_category: e.target.value }))}
                      className="bg-gray-950 text-white"
                      placeholder="e.g., Technical, Design, Management"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-white">Proficiency Level</Label>
                  <Select 
                    value={skillFormData.proficiency_level.toString()} 
                    onValueChange={(value) => setSkillFormData(prev => ({ ...prev, proficiency_level: parseInt(value) }))}
                  >
                    <SelectTrigger className="bg-gray-950 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-950">
                      {proficiencyLevels.map(level => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {renderStars(level.value)}
                            </div>
                            <span>{level.label} - {level.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="years-experience" className="text-white">Years of Experience</Label>
                  <Input
                    id="years-experience"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={skillFormData.years_experience}
                    onChange={(e) => setSkillFormData(prev => ({ ...prev, years_experience: parseFloat(e.target.value) || 0 }))}
                    className="bg-gray-950 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddSkillOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={addSkillToEmployee}
                  disabled={processingSkills.has('new-skill') || !skillFormData.skill_name.trim() || !skillFormData.skill_category.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {processingSkills.has('new-skill') ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Skill
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="w-full max-w-md">
        <Label htmlFor="search" className="text-white">Search My Skills</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            id="search"
            placeholder="Search for skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-950 text-white"
          />
        </div>
      </div>

      {/* My Skills Grid */}
      <Card className="bg-white border-gray-700">
        <CardHeader>
          <CardTitle className="text-black">My Skills ({employeeSkills.length})</CardTitle>
          <CardDescription className="text-gray-400">
            Your current skills and proficiency levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSkills.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {employeeSkills.length === 0 
                  ? "No skills added yet. Start by adding some skills!" 
                  : "No skills match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => {
                const proficiencyInfo = getProficiencyInfo(skill.proficiency_level)
                return (
                  <Card key={skill.id} className="bg-gray-100 border-gray-100">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-sm font-medium text-black">{skill.skill_name}</CardTitle>
                          <Badge variant="outline" className="text-xs mt-1 border-gray-400 text-gray-600">
                            {skill.skill_category}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeEmployeeSkill(skill.id)}
                          disabled={processingSkills.has(skill.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          {processingSkills.has(skill.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {renderStars(skill.proficiency_level)}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full text-white ${proficiencyInfo.color}`}>
                            {proficiencyInfo.label}
                          </span>
                        </div>
                        {skill.years_experience > 0 && (
                          <p className="text-xs text-gray-600">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {skill.years_experience} years experience
                          </p>
                        )}
                        {skill.notes && (
                          <p className="text-xs text-gray-600 italic">
                            "{skill.notes}"
                          </p>
                        )}
                        {skill.last_used && (
                          <p className="text-xs text-gray-500">
                            Last used: {new Date(skill.last_used).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}