"use client"

import { useState, useEffect } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import toast from 'react-hot-toast';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string[];
  notes?: string;
}

export default function MedsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedication, setNewMedication] = useState<Medication>({
    name: '',
    dosage: '',
    frequency: '',
    timeOfDay: [],
    notes: ''
  });

  const timeOptions = ['Morning', 'Afternoon', 'Evening', 'Bedtime'];

  useEffect(() => {
    const storedMeds = localStorage.getItem('medications');
    if (storedMeds) {
      setMedications(JSON.parse(storedMeds));
    }
  }, []);

  const handleTimeSelection = (time: string) => {
    setNewMedication(prev => ({
      ...prev,
      timeOfDay: prev.timeOfDay.includes(time)
        ? prev.timeOfDay.filter(t => t !== time)
        : [...prev.timeOfDay, time]
    }));
  };

  const handleSaveMedication = () => {
    if (!newMedication.name || !newMedication.dosage || !newMedication.frequency || newMedication.timeOfDay.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const updatedMedications = [...medications, newMedication];
    setMedications(updatedMedications);
    
    localStorage.setItem('medications', JSON.stringify(updatedMedications));
    
    setNewMedication({
      name: '',
      dosage: '',
      frequency: '',
      timeOfDay: [],
      notes: ''
    });
    setShowAddModal(false);
    toast.success('Medication added successfully');
  };

  const handleDeleteMedication = (index: number) => {
    const updatedMedications = medications.filter((_, i) => i !== index);
    setMedications(updatedMedications);
    localStorage.setItem('medications', JSON.stringify(updatedMedications));
    toast.success('Medication deleted successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[#FE3301]">
            Medications
          </h1>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Medication
          </Button>
        </div>

        {/* Medications List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {medications.map((med, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm relative">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[#FE3301]">{med.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMedication(index)}
                  className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-red-100 rounded-full"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Dosage:</strong> {med.dosage}</p>
                  <p><strong>Frequency:</strong> {med.frequency}</p>
                  <p><strong>Time of Day:</strong> {med.timeOfDay.join(', ')}</p>
                  {med.notes && <p><strong>Notes:</strong> {med.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Medication Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">Add Medication</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Medication Name</label>
                  <Input
                    placeholder="Enter medication name"
                    value={newMedication.name}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Dosage</label>
                  <Input
                    placeholder="e.g., 50mg"
                    value={newMedication.dosage}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Input
                    placeholder="e.g., Once daily"
                    value={newMedication.frequency}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time of Day</label>
                  <div className="flex flex-wrap gap-2">
                    {timeOptions.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={newMedication.timeOfDay.includes(time) ? "default" : "outline"}
                        className={`rounded-full ${
                          newMedication.timeOfDay.includes(time)
                            ? 'bg-[#FE3301] text-white hover:bg-[#FE3301]/90'
                            : 'hover:bg-[#FE3301]/10'
                        }`}
                        onClick={() => handleTimeSelection(time)}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Textarea
                    placeholder="Add any special instructions"
                    value={newMedication.notes}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>

                <Button
                  className="w-full bg-[#FE3301] text-white hover:bg-[#FE3301]/90 mt-4"
                  onClick={handleSaveMedication}
                >
                  Save Medication
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}  